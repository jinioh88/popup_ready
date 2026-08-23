package com.popupready.server.door;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.popupready.server.common.ApiException;
import com.popupready.server.common.ErrorCode;
import com.popupready.server.reservation.ReservationAccess;
import com.popupready.server.reservation.ReservationRequestService;
import com.popupready.server.reservation.ReservationStatus;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Optional;
import java.util.function.Supplier;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/**
 * 도어 개방·마감 유스케이스(T4-3·T4-4). 시간창 판정은 {@link DoorWindowTest}가, 상태 전이는
 * {@link DoorEventTest}가 각각 순수 테스트로 잠그므로 여기서는 <b>순서와 인가</b>를 본다.
 *
 * <p>403의 갈래가 셋이다 — <b>당사자 아님 · 미결제 · 시간창 밖</b>. 셋 다 실제로 거절되는지가
 * 이 스토리의 핵심이고, 스텁은 이 경로에 도달조차 하지 못했다.
 */
@ExtendWith(MockitoExtension.class)
class DoorServiceTest {

    private static final long BRAND = 7L;

    private static final long STRANGER = 99L;

    private static final LocalDate START = LocalDate.of(2026, 9, 1);

    private static final LocalDate END = LocalDate.of(2026, 9, 14);

    /** 사용 기간 한가운데 — 시간창은 열려 있다. */
    private static final Instant INSIDE_WINDOW = Instant.parse("2026-09-07T05:00:00Z");

    @Mock
    private ReservationRequestService reservationRequestService;

    @Mock
    private DoorEventRepository doorEventRepository;

    private final Supplier<Instant> clock = () -> INSIDE_WINDOW;

    private DoorService service() {
        return new DoorService(reservationRequestService, doorEventRepository, clock);
    }

    private DoorService serviceAt(Instant now) {
        return new DoorService(reservationRequestService, doorEventRepository, () -> now);
    }

    private void reservation(ReservationStatus status) {
        given(reservationRequestService.findForDoorAccess(45L))
                .willReturn(new ReservationAccess(45L, 1L, BRAND, START, END, status));
    }

    private void savesEvent() {
        given(doorEventRepository.save(any())).willAnswer(call -> call.getArgument(0));
    }

    @Test
    @DisplayName("당사자·결제·시간창을 모두 통과 → 발행할 토픽과 페이로드를 내려준다")
    void open_allChecksPass_returnsTopicAndPayload() {
        reservation(ReservationStatus.PAID);
        savesEvent();

        DoorOpenResponse response = service().open(BRAND, 45L);

        assertThat(response.topic()).isEqualTo("popupready/locks/1/command");
        assertThat(response.statusTopic()).isEqualTo("popupready/locks/1/status");
        assertThat(response.payload().reservationId()).isEqualTo(45L);
        assertThat(response.payload().action()).isEqualTo("OPEN");
        assertThat(response.status()).isEqualTo(DoorEventStatus.AUTHORIZED);
    }

    @Test
    @DisplayName("🚨 403 갈래 ① 당사자가 아닌 사용자 → 거절하고 기록도 남기지 않는다")
    void open_byStranger_isForbidden() {
        reservation(ReservationStatus.PAID);

        assertThatThrownBy(() -> service().open(STRANGER, 45L))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getErrorCode())
                .isEqualTo(ErrorCode.FORBIDDEN);
        verify(doorEventRepository, never()).save(any());
    }

    @Test
    @DisplayName("🚨 403 갈래 ② 결제되지 않은 예약 → RESERVATION_NOT_PAID(시간창과 다른 코드)")
    void open_unpaidReservation_isRejected() {
        // 클라이언트는 이 판정을 하지 않는다 — 여기서 막지 않으면 어디에서도 막히지 않는다.
        //
        // 시간창 밖과 코드를 나눈 이유: 같은 코드로 내보내면 클라이언트가 "조금만 기다리면
        // 열린다"고 안내하는데, 미결제는 기다려도 열리지 않아 화면이 거짓을 말한다.
        // 게이트가 서버라는 규칙은 판정뿐 아니라 사유에도 적용된다(모바일 제기, 2026-08-23).
        reservation(ReservationStatus.CONTRACT_SIGNED);

        assertThatThrownBy(() -> service().open(BRAND, 45L))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getErrorCode())
                .isEqualTo(ErrorCode.RESERVATION_NOT_PAID);
        verify(doorEventRepository, never()).save(any());
    }

    @Test
    @DisplayName("🚨 403 갈래 ③ 시간창 밖 → DOOR_NOT_YET_OPENABLE")
    void open_outsideWindow_isRejected() {
        reservation(ReservationStatus.PAID);

        assertThatThrownBy(
                        () -> serviceAt(Instant.parse("2026-08-01T00:00:00Z")).open(BRAND, 45L))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getErrorCode())
                .isEqualTo(ErrorCode.DOOR_NOT_YET_OPENABLE);
    }

    @Test
    @DisplayName("자격 판정이 결제·시간창보다 먼저다 → 남의 예약의 상태가 새지 않는다")
    void open_authorizationCheckedBeforeState() {
        // 순서가 반대면 403 메시지의 차이로 "그 예약이 결제됐는지"가 드러난다.
        reservation(ReservationStatus.CONTRACT_SIGNED);

        assertThatThrownBy(() -> service().open(STRANGER, 45L))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getErrorCode())
                .isEqualTo(ErrorCode.FORBIDDEN);
    }

    @Test
    @DisplayName("발행 성공 보고 → DELIVERED로 마감된다")
    void ack_byOwner_marksDelivered() {
        DoorEvent event = DoorEvent.authorize(45L, BRAND, "popupready/locks/1/command", INSIDE_WINDOW);
        given(doorEventRepository.findById(123L)).willReturn(Optional.of(event));

        assertThat(service().ack(BRAND, 123L, true).status()).isEqualTo(DoorEventStatus.DELIVERED);
    }

    @Test
    @DisplayName("🚨 남의 이벤트를 ack → 거절한다(전송 기록 위조 경로)")
    void ack_byStranger_isForbidden() {
        // 개방만 막고 ack를 열어두면 남의 이벤트를 임의로 DELIVERED/FAILED로 뒤집을 수 있다.
        // ack를 둔 이유가 기록을 성립시키는 것인데, 그 기록이 위조 가능하면 값어치가 없다.
        DoorEvent event = DoorEvent.authorize(45L, BRAND, "popupready/locks/1/command", INSIDE_WINDOW);
        given(doorEventRepository.findById(123L)).willReturn(Optional.of(event));

        assertThatThrownBy(() -> service().ack(STRANGER, 123L, true))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getErrorCode())
                .isEqualTo(ErrorCode.FORBIDDEN);
        assertThat(event.getStatus()).as("거절됐으면 상태가 그대로여야 한다").isEqualTo(DoorEventStatus.AUTHORIZED);
    }

    @Test
    @DisplayName("🚨 없는 이벤트를 ack → 404(존재하지 않는 전송 기록이 생기지 않는다)")
    void ack_missingEvent_isNotFound() {
        given(doorEventRepository.findById(404L)).willReturn(Optional.empty());

        assertThatThrownBy(() -> service().ack(BRAND, 404L, true))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getErrorCode())
                .isEqualTo(ErrorCode.NOT_FOUND);
    }

    @Test
    @DisplayName("🚨 이미 마감된 이벤트를 다시 ack → 409이지 500이 아니다")
    void ack_alreadyClosed_isConflictNotServerError() {
        // 엔티티의 IllegalStateException을 그대로 새어나가게 두면 500이 된다. 재-ack은 더블
        // 서브밋 같은 클라이언트 실수라, 500으로 알리면 웹·모바일이 서버 장애로 읽고 재시도한다 —
        // 재시도로 낫는 상황이 아니다. 실서버 왕복에서 실제로 500이 나와 발견했다.
        DoorEvent event = DoorEvent.authorize(45L, BRAND, "popupready/locks/1/command", INSIDE_WINDOW);
        event.ack(true, INSIDE_WINDOW);
        given(doorEventRepository.findById(123L)).willReturn(Optional.of(event));

        assertThatThrownBy(() -> service().ack(BRAND, 123L, false))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getErrorCode())
                .isEqualTo(ErrorCode.DOOR_EVENT_ALREADY_ACKED);
    }
}
