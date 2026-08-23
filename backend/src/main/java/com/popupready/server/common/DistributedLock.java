package com.popupready.server.common;

import java.util.Comparator;
import java.util.List;
import java.util.concurrent.TimeUnit;
import java.util.function.Supplier;
import org.redisson.api.RLock;
import org.redisson.api.RedissonClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * 여러 키를 한 번에 잡는 분산 락(US-201, §2.2-C 1단계).
 *
 * <h2>왜 여러 키인가</h2>
 *
 * 공간 락 하나로는 부족하다. <b>집기는 공간을 가로지르기 때문</b>이다 — 공간 1과 공간 2의 예약이
 * 같은 집기의 마지막 1개를 동시에 잡으면 공간 락 둘은 서로 다른 키라 나란히 통과한다.
 *
 * <h2>왜 키에 기간이 없는가</h2>
 *
 * 당초 스펙은 {@code lock:reservation:{spaceId}:{start}:{end}}였다. 그러면 바로 다음 단계인
 * "기간 겹침 재확인"이 락 밖으로 나간다 — A[9/01~9/05]와 B[9/03~9/07]는 서로 다른 키라
 * 동시에 통과하고 둘 다 커밋된다. 인수 조건이 "동일 기간"이라 테스트는 초록인데 막으려던 사고는
 * 그대로 남는다. 그래서 기간을 키에서 뺐다.
 *
 * <h2>정렬을 코드가 강제한다</h2>
 *
 * 여러 락을 잡는 순간 데드락이 가능해진다. 호출자에게 "정렬해서 넘기세요"라고 규칙으로 부탁하지
 * 않고 <b>여기서 정렬한다</b> — 규칙은 지켜지지 않고, 안 지켜진 흔적은 교착으로만 나타난다.
 *
 * <h2>leaseTime이 PG 타임아웃보다 길어야 한다</h2>
 *
 * 승인 트랜잭션 안에서 외부 PG를 부르므로 락 보유 시간이 그만큼 길어진다. leaseTime이 짧으면
 * PG 응답을 기다리는 도중 락이 자동 해제되어 <b>이중 예약 창이 열린다</b>.
 */
@Component
public class DistributedLock {

    private static final Logger log = LoggerFactory.getLogger(DistributedLock.class);

    /** 재시도 횟수. CLAUDE.md 명문 규칙이다. */
    private static final int MAX_ATTEMPTS = 3;

    private final RedissonClient redisson;

    private final long waitSeconds;

    private final long leaseSeconds;

    public DistributedLock(
            RedissonClient redisson,
            @Value("${popupready.lock.wait-seconds}") long waitSeconds,
            @Value("${popupready.lock.lease-seconds}") long leaseSeconds) {
        this.redisson = redisson;
        this.waitSeconds = waitSeconds;
        this.leaseSeconds = leaseSeconds;
    }

    /**
     * 키 전부를 잡고 {@code action}을 실행한다. 못 잡으면 503으로 끊는다 — 사용자 잘못이 아니므로
     * 클라이언트는 재시도를 안내한다.
     */
    public <T> T withKeys(List<String> keys, Supplier<T> action) {
        // 중복을 제거하고 정렬한다. 순서가 호출마다 다르면 서로가 서로를 기다린다.
        List<String> ordered =
                keys.stream().distinct().sorted(Comparator.naturalOrder()).toList();
        RLock lock =
                redisson.getMultiLock(ordered.stream().map(redisson::getLock).toArray(RLock[]::new));

        boolean acquired = acquire(lock, ordered);
        if (!acquired) {
            throw new ApiException(ErrorCode.LOCK_ACQUISITION_FAILED, "지금은 처리할 수 없습니다. 잠시 후 다시 시도해 주세요");
        }
        try {
            return action.get();
        } finally {
            // 해제는 래퍼 안에서만 일어난다 — 호출자가 잊을 여지를 만들지 않는다.
            lock.unlock();
        }
    }

    private boolean acquire(RLock lock, List<String> keys) {
        for (int attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            try {
                if (lock.tryLock(waitSeconds, leaseSeconds, TimeUnit.SECONDS)) {
                    return true;
                }
                log.warn("락 획득 실패 {}/{} — keys={}", attempt, MAX_ATTEMPTS, keys);
            } catch (InterruptedException e) {
                // 인터럽트를 삼키면 종료 신호가 사라진다. 플래그를 복원하고 즉시 포기한다.
                Thread.currentThread().interrupt();
                return false;
            }
        }
        return false;
    }
}
