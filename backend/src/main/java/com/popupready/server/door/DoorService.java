package com.popupready.server.door;

import com.popupready.server.common.ApiException;
import com.popupready.server.common.ErrorCode;
import com.popupready.server.reservation.ReservationAccess;
import com.popupready.server.reservation.ReservationRequestService;
import com.popupready.server.reservation.ReservationStatus;
import java.time.Instant;
import java.util.function.Supplier;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 도어 오픈 권한 검증·기록(US-301, §2.3).
 *
 * <p><b>게이트는 서버다.</b> 클라이언트가 버튼을 켜고 끄는 것은 편의이며, 실제 판정은 여기서
 * 세 갈래로 갈린다 — <b>당사자 아님 · 미결제 · 시간창 밖</b>. 셋 다 403이지만 원인이 다르다.
 *
 * <p>백엔드는 MQTT 클라이언트를 갖지 않는다. 발행은 모바일이 하고 서버는 <b>무엇을 발행할지</b>를
 * 내려줄 뿐이다(CLAUDE.md의 모킹 구조 유지).
 */
@Service
@Transactional
public class DoorService {

    private final ReservationRequestService reservationRequestService;

    private final DoorEventRepository doorEventRepository;

    private final Supplier<Instant> clock;

    public DoorService(
            ReservationRequestService reservationRequestService,
            DoorEventRepository doorEventRepository,
            Supplier<Instant> clock) {
        this.reservationRequestService = reservationRequestService;
        this.doorEventRepository = doorEventRepository;
        this.clock = clock;
    }

    public DoorOpenResponse open(long userId, Long reservationRequestId) {
        // 없는 예약은 여기서 404로 끊긴다. 자격 확인을 존재 확인보다 앞에 둘 수 없는 유일한
        // 경우다 — 무엇의 당사자인지 알아야 판정할 수 있다.
        ReservationAccess reservation = reservationRequestService.findForDoorAccess(reservationRequestId);

        requireBrandParty(reservation, userId);
        requirePaid(reservation);
        requireWithinWindow(reservation);

        Instant now = clock.get();
        String topic = DoorTopics.command(String.valueOf(reservation.spaceId()));
        DoorEvent event = doorEventRepository.save(DoorEvent.authorize(reservation.id(), userId, topic, now));

        return new DoorOpenResponse(
                event.getId(),
                topic,
                DoorTopics.status(String.valueOf(reservation.spaceId())),
                new DoorCommandPayload(event.getId(), reservation.id(), "OPEN", now),
                event.getStatus());
    }

    /**
     * 발행 결과 보고로 이벤트를 마감한다(§2.3 ③).
     *
     * <p><b>인가가 ①과 같은 강도여야 한다.</b> 개방만 막고 ack를 열어두면 남의 이벤트를 임의로
     * DELIVERED/FAILED로 뒤집을 수 있고, 그건 전송 기록을 <b>위조</b>하는 경로다 — ack를 둔 이유가
     * 기록을 성립시키는 것인데 그 기록이 위조 가능하면 값어치가 없다.
     */
    public DoorAckResponse ack(long userId, Long eventId, boolean success) {
        DoorEvent event = doorEventRepository
                .findById(eventId)
                // 없는 이벤트의 ack를 받아주면 존재하지 않는 전송 기록이 조용히 생긴다.
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "도어 이벤트를 찾을 수 없습니다"));
        if (!event.isOwnedBy(userId)) {
            throw new ApiException(ErrorCode.FORBIDDEN, "이 도어 이벤트의 요청자가 아닙니다");
        }
        event.ack(success, clock.get());
        return new DoorAckResponse(event.getId(), event.getStatus(), event.getAckedAt());
    }

    /** 문을 여는 것은 현장 운영자, 즉 <b>그 예약의 브랜드</b>다. 건물주는 열지 않는다. */
    private static void requireBrandParty(ReservationAccess reservation, long userId) {
        if (reservation.brandUserId() != userId) {
            throw new ApiException(ErrorCode.FORBIDDEN, "이 예약의 당사자가 아닙니다");
        }
    }

    /**
     * 결제되지 않은 예약으로 문이 열려선 안 된다.
     *
     * <p>클라이언트는 이 판정을 하지 않는다 — 여기서 막지 않으면 어디에서도 막히지 않는다.
     */
    private static void requirePaid(ReservationAccess reservation) {
        if (reservation.status() != ReservationStatus.PAID) {
            throw new ApiException(
                    ErrorCode.DOOR_NOT_YET_OPENABLE,
                    "결제가 완료된 예약만 개방할 수 있습니다 (현재 상태: %s)".formatted(reservation.status()));
        }
    }

    private void requireWithinWindow(ReservationAccess reservation) {
        if (!DoorWindow.isOpen(reservation.startDate(), reservation.endDate(), clock.get())) {
            throw new ApiException(
                    ErrorCode.DOOR_NOT_YET_OPENABLE,
                    "지금은 개방할 수 있는 시간이 아닙니다 (사용 기간: %s ~ %s, 시작 10분 전부터 열립니다)"
                            .formatted(reservation.startDate(), reservation.endDate()));
        }
    }
}
