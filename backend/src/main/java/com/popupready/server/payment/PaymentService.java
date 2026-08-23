package com.popupready.server.payment;

import com.popupready.server.common.ApiException;
import com.popupready.server.common.DistributedLock;
import com.popupready.server.common.ErrorCode;
import com.popupready.server.reservation.ReservationRequestResponse;
import com.popupready.server.reservation.ReservationRequestService;
import com.popupready.server.reservation.ReservationStatus;
import java.time.Instant;
import java.util.UUID;
import java.util.function.Supplier;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * 결제 준비·승인의 <b>바깥 껍질</b>(US-201).
 *
 * <p>이 클래스가 아는 것은 순서다 — 준비는 락 없이, 승인은 락 안에서. 승인의 실제 절차
 * (§2.2-C 2-0 ~ 2-7)는 {@link PaymentApprover}가 갖는다.
 *
 * <p>둘을 나눈 이유는 <b>자기 호출 문제</b>다. 락을 감싸는 메서드와 트랜잭션 메서드를 한 클래스에
 * 두면 프록시를 거치지 않아 {@code @Transactional}이 적용되지 않는다 — 애노테이션은 붙어 있는데
 * 트랜잭션은 열리지 않고, 그 사실은 조용하다.
 */
@Service
public class PaymentService {

    private final ReservationRequestService reservationRequestService;
    private final PaymentRepository paymentRepository;
    private final DistributedLock distributedLock;
    private final PaymentApprover paymentApprover;
    private final Supplier<Instant> clock;

    public PaymentService(
            ReservationRequestService reservationRequestService,
            PaymentRepository paymentRepository,
            DistributedLock distributedLock,
            PaymentApprover paymentApprover,
            Supplier<Instant> clock) {
        this.reservationRequestService = reservationRequestService;
        this.paymentRepository = paymentRepository;
        this.distributedLock = distributedLock;
        this.paymentApprover = paymentApprover;
        this.clock = clock;
    }

    /**
     * 결제 준비. <b>락을 잡지 않는다</b>(§2.2-A) — 위젯 표시용이며 자리를 선점하지 않는다.
     *
     * <p>별도 트랜잭션으로 커밋하는 것이 의도다. 승인이 타임아웃 나도 <b>시도 흔적이 남아야</b>
     * 하고, 승인 트랜잭션이 롤백될 때 준비 기록까지 함께 사라지면 분쟁 시 볼 것이 없다.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public PaymentPrepareResponse prepare(long userId, Long reservationRequestId) {
        ReservationRequestResponse reservation = reservationRequestService.snapshot(reservationRequestId);
        requireBrand(reservation, userId);
        requirePayable(reservation);

        long amount = reservation.estimate().totalAmount();
        // orderId는 시도마다 새로 발급하고 재사용하지 않는다(2026-08-23 결정) — 이미 승인 시도된
        // orderId는 PG가 거부할 수 있고, 재사용하면 "실제로는 승인됐는데 응답만 유실된" 경우와
        // "정말 실패한" 경우를 구분할 수 없다.
        String orderId = "PR-" + reservationRequestId + "-"
                + UUID.randomUUID().toString().substring(0, 8);
        paymentRepository.save(Payment.ready(reservationRequestId, orderId, amount, clock.get()));

        if (reservation.status() == ReservationStatus.CONTRACT_SIGNED) {
            reservationRequestService.markPaymentPending(reservationRequestId);
        }
        return new PaymentPrepareResponse(orderId, amount, orderName(reservation));
    }

    /**
     * 결제 승인(§2.2-C 1 ~ 3단계). 락을 잡고 승인 본문을 실행한 뒤 {@code finally}로 해제한다 —
     * 해제는 {@link DistributedLock} 안에서만 일어난다.
     *
     * <p><b>락이 트랜잭션보다 바깥이어야 한다.</b> 반대로 감싸면 트랜잭션이 커밋되기 전에 락이
     * 풀려, 뒤따라 들어온 요청이 아직 보이지 않는 커밋을 못 보고 통과한다 — 락이 있는데도
     * 이중 예약이 나는 가장 흔한 형태다.
     */
    public PaymentConfirmResponse confirm(long userId, Long reservationRequestId, PaymentConfirmRequest request) {
        // 락 키를 만들려면 어떤 공간·집기인지 알아야 한다. 이 조회는 락 밖이지만, 여기서 읽는
        // 값(공간·배치)은 예약 생성 이후 바뀌지 않으므로 경합이 없다.
        ReservationRequestResponse forKeys = reservationRequestService.snapshot(reservationRequestId);
        return distributedLock.withKeys(
                PaymentLockKeys.of(forKeys), () -> paymentApprover.approve(userId, reservationRequestId, request));
    }

    private static void requireBrand(ReservationRequestResponse reservation, long userId) {
        if (reservation.brandUserId() != userId) {
            throw new ApiException(ErrorCode.FORBIDDEN, "이 예약의 당사자가 아닙니다");
        }
    }

    /** 계약 서명이 끝나야 결제할 수 있다. 준비를 다시 눌러도 되도록 PAYMENT_PENDING도 허용한다. */
    private static void requirePayable(ReservationRequestResponse reservation) {
        boolean payable = reservation.status() == ReservationStatus.CONTRACT_SIGNED
                || reservation.status() == ReservationStatus.PAYMENT_PENDING;
        if (!payable) {
            throw new ApiException(
                    ErrorCode.VALIDATION_FAILED,
                    "계약 서명이 끝난 예약만 결제할 수 있습니다 (현재 상태: %s)".formatted(reservation.status()));
        }
    }

    private static String orderName(ReservationRequestResponse reservation) {
        return "팝업 공간 %d일 대여".formatted(reservation.estimate().days());
    }
}
