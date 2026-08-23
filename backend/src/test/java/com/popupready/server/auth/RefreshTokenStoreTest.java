package com.popupready.server.auth;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.time.Instant;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.redis.core.StringRedisTemplate;

/**
 * Refresh 토큰 저장·회전(T1-1). <b>로컬 Redis 대상 슬라이스 테스트</b>다 —
 * TTL과 원자적 교체가 저장소의 실제 동작에 달려 있어 가짜 구현으로는 증명되지 않는다.
 *
 * <p><b>시계를 주입한다.</b> 유예 안의 경합과 유예를 넘긴 재사용은 시간 차이 하나로 갈리는데,
 * 실제 시계에 기대면 sleep이 필요해지고 그런 테스트는 느리면서 잘 깨진다. 시계를 밀어 두 경로를
 * 결정적으로 재현한다.
 */
@SpringBootTest
class RefreshTokenStoreTest {

    private static final long USER_ID = 7L;

    @Autowired
    private StringRedisTemplate redis;

    private static final Duration GRACE = Duration.ofSeconds(30);

    private final AtomicReference<Instant> now = new AtomicReference<>(Instant.parse("2026-09-01T00:00:00Z"));

    private RefreshTokenStore store;

    @BeforeEach
    void clearKeys() {
        var keys = redis.keys("popupready:refresh:*");
        if (keys != null && !keys.isEmpty()) {
            redis.delete(keys);
        }
        now.set(Instant.parse("2026-09-01T00:00:00Z"));
        store = new RefreshTokenStore(redis, Duration.ofDays(14), GRACE, now::get);
    }

    /** 유예 창 밖으로 시계를 민다. */
    private void passGraceWindow() {
        now.updateAndGet(instant -> instant.plus(GRACE).plusSeconds(1));
    }

    @Test
    @DisplayName("발급된 토큰으로 회전 → 새 토큰을 받고 이전 것과 다르다")
    void rotate_withActiveToken_issuesDifferentToken() {
        String issued = store.issue(USER_ID);

        RefreshTokenStore.Rotation rotation = store.rotate(issued);

        assertThat(rotation.userId()).isEqualTo(USER_ID);
        assertThat(rotation.refreshToken()).isNotEqualTo(issued);
    }

    @Test
    @DisplayName("회전 뒤 옛 토큰 재사용(유예 없음) → 거절")
    void rotate_reusedToken_isRejected() {
        String issued = store.issue(USER_ID);
        store.rotate(issued);
        passGraceWindow();

        assertThat(store.rotate(issued)).isNull();
    }

    @Test
    @DisplayName("옛 토큰 재사용이 감지되면 → 그 패밀리의 후속 토큰까지 함께 무효가 된다")
    void rotate_reuseDetected_revokesWholeFamily() {
        // 재사용은 유출 신호다. 도둑과 정상 사용자 중 누가 옛 토큰을 들고 왔는지 알 수 없으므로
        // 그 세션 전체를 끊는다 — 후속 토큰만 살려두면 도둑이 계속 회전할 수 있다.
        String issued = store.issue(USER_ID);
        String successor = store.rotate(issued).refreshToken();
        passGraceWindow();

        store.rotate(issued);

        assertThat(store.rotate(successor)).isNull();
    }

    @Test
    @DisplayName("🚨 유예 창 안의 재사용 → 폐기하지 않고 같은 후속 토큰을 돌려준다")
    void rotate_withinGraceWindow_returnsSameSuccessor() {
        // 모바일 제기(2026-08-23): 동시 요청 여러 건이 함께 만료를 맞으면 재발급도 여러 번 나간다.
        // 첫 번째가 성공하는 순간 나머지가 든 토큰은 옛 것이 되고, 유예가 없으면 <b>정상 클라이언트가
        // 경합만으로 세션 전체를 잃는다.</b> 실사용에서 가장 흔한 오탐이라 서버가 막는다.
        String issued = store.issue(USER_ID);
        String successor = store.rotate(issued).refreshToken();

        RefreshTokenStore.Rotation raced = store.rotate(issued);

        assertThat(raced).isNotNull();
        assertThat(raced.refreshToken()).isEqualTo(successor);
        // 후속 토큰이 살아 있어야 한다 — 경합이 세션을 끊지 않았다는 뜻이다.
        assertThat(store.rotate(successor)).isNotNull();
    }

    @Test
    @DisplayName("알 수 없는 토큰 → 거절")
    void rotate_unknownToken_isRejected() {
        assertThat(store.rotate("never-issued")).isNull();
    }

    @Test
    @DisplayName("한 기기의 재사용 감지가 → 다른 기기의 세션을 끊지 않는다")
    void rotate_reuseDetected_doesNotAffectOtherSessions() {
        // 로그인마다 패밀리가 갈린다. 사용자 단위로 폐기하면 휴대폰의 오탐 하나로 데스크톱까지
        // 로그아웃된다 — 폐기 범위는 사용자가 아니라 그 세션이다.
        String phone = store.issue(USER_ID);
        String desktop = store.issue(USER_ID);
        store.rotate(phone);
        passGraceWindow();

        store.rotate(phone);

        assertThat(store.rotate(desktop)).isNotNull();
    }

    @Test
    @DisplayName("유예를 넘긴 재사용 → 이정표가 남아 있어 '알 수 없는 토큰'이 아니라 유출로 판정된다")
    void rotate_afterGrace_isDetectedAsReuseNotUnknown() {
        // 이정표를 유예 길이만큼만 남기면 옛 토큰이 그냥 사라져 재사용이 미발급과 구분되지 않는다.
        // 그러면 도둑의 토큰만 조용히 거절되고 패밀리는 살아남는다 — 감지가 사라지는 것이다.
        String issued = store.issue(USER_ID);
        String successor = store.rotate(issued).refreshToken();
        passGraceWindow();

        assertThat(store.rotate(issued)).isNull();
        assertThat(store.rotate(successor)).as("재사용이 감지됐다면 후속 토큰도 함께 죽어 있어야 한다").isNull();
    }

    @Test
    @DisplayName("🚨 같은 토큰으로 동시에 회전 → 후속 토큰은 정확히 하나여야 한다")
    void rotate_concurrentSameToken_producesSingleSuccessor() throws Exception {
        // 순차 테스트로는 증명되지 않는다. 실서버(:8080)에서 동시 요청 2건이 <b>서로 다른</b>
        // 후속 토큰을 받는 것이 발견됐다 — 둘 다 ACTIVE를 읽은 뒤 각자 회전한 read-modify-write
        // 경합이다. 그러면 한 패밀리에 살아 있는 토큰이 둘이 되고, 이정표는 그중 하나만 가리켜
        // 재사용 감지가 무의미해진다(도둑과 정상 사용자가 나란히 회전해도 아무도 걸리지 않는다).
        String issued = store.issue(USER_ID);
        int threads = 8;
        CountDownLatch start = new CountDownLatch(1);
        CountDownLatch done = new CountDownLatch(threads);
        Set<String> successors = ConcurrentHashMap.newKeySet();
        ExecutorService pool = Executors.newFixedThreadPool(threads);
        try {
            for (int i = 0; i < threads; i++) {
                pool.submit(() -> {
                    try {
                        start.await();
                        RefreshTokenStore.Rotation rotation = store.rotate(issued);
                        if (rotation != null) {
                            successors.add(rotation.refreshToken());
                        }
                    } catch (InterruptedException e) {
                        Thread.currentThread().interrupt();
                    } finally {
                        done.countDown();
                    }
                });
            }
            start.countDown();
            assertThat(done.await(10, TimeUnit.SECONDS)).isTrue();
        } finally {
            pool.shutdownNow();
        }

        assertThat(successors).as("동시 회전이 만든 후속 토큰").hasSize(1);
    }
}
