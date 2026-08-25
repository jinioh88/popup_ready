package com.popupready.server.reservation;

import com.popupready.server.common.ApiException;
import com.popupready.server.common.ErrorCode;
import java.time.LocalDate;
import org.springframework.stereotype.Service;

/**
 * 같은 공간에 기간이 겹치는 <b>결제 완료</b> 예약이 있는가(§2.2-C 2-2).
 *
 * <p><b>판정은 한 벌이다.</b> 예약 생성(조기 안내)과 결제 승인(최종 판정)이 이 메서드를 함께
 * 부른다. 두 벌로 만들면 판정이 갈리는 순간 "생성은 통과했는데 결제에서 막히는" 조합이 그대로
 * 남는다 — 이 클래스가 존재하는 이유가 그것뿐이다.
 *
 * <p><b>이 클래스는 락을 잡지 않는다.</b> 직렬화는 호출자의 책임이다. 결제 승인은 분산 락 안에서
 * 부르므로 게이트가 되고, 예약 생성은 락 밖에서 부르므로 안내에 그친다 —
 * {@link #requireNoOverlap} 주석 참조.
 */
@Service
public class SpaceOverlapChecker {

    /**
     * 제외할 자기 자신이 없을 때 쓰는 ID. 엔티티 ID는 시퀀스가 발급하는 양수이므로 어떤 행과도
     * 같지 않다.
     *
     * <p>null을 그대로 넘기면 안 된다 — {@code r.id <> :excludeId}가 null로 평가돼 모든 행이
     * 걸러지고, 겹치는 예약이 있어도 늘 통과하는 조용히 무력한 검사가 된다.
     */
    private static final long NOTHING_TO_EXCLUDE = -1L;

    private final ReservationRequestRepository reservationRequestRepository;

    public SpaceOverlapChecker(ReservationRequestRepository reservationRequestRepository) {
        this.reservationRequestRepository = reservationRequestRepository;
    }

    /**
     * 겹치면 409 {@code SPACE_ALREADY_BOOKED}로 거절한다. 호출자의 트랜잭션 안에서 조회한다.
     *
     * @param excludeReservationId 판정에서 뺄 자기 자신. 아직 저장 전이면 {@code null}
     */
    public void requireNoOverlap(Long spaceId, LocalDate startDate, LocalDate endDate, Long excludeReservationId) {
        boolean taken = reservationRequestRepository.existsPaidOverlapping(
                spaceId, startDate, endDate, excludeReservationId == null ? NOTHING_TO_EXCLUDE : excludeReservationId);
        if (taken) {
            // 집기 부족과 코드를 나눈다 — 사용자가 할 일이 다르다. 이쪽은 기간을 옮겨야 하고,
            // 집기 부족은 배치를 줄여도 된다. 뭉개면 "집기를 빼보세요"가 나가는데 해소되지 않는다.
            throw new ApiException(ErrorCode.SPACE_ALREADY_BOOKED, "이미 예약된 기간입니다");
        }
    }
}
