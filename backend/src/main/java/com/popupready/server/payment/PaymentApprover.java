package com.popupready.server.payment;

import com.popupready.server.common.ApiException;
import com.popupready.server.common.ErrorCode;
import com.popupready.server.contract.ContractService;
import com.popupready.server.reservation.BookingRevalidator;
import com.popupready.server.reservation.ReservationRequestResponse;
import com.popupready.server.reservation.ReservationRequestService;
import com.popupready.server.reservation.ReservationStatus;
import com.popupready.server.settlement.SettlementResponse;
import com.popupready.server.settlement.SettlementService;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 결제 승인의 트랜잭션 본문(§2.2-C 2-0 ~ 2-7).
 *
 * <p><b>{@link PaymentService}와 별도 빈인 것이 핵심이다.</b> 같은 클래스의 메서드로 두면
 * 락을 감싸는 쪽에서 자기 호출이 되어 프록시를 거치지 않고, 그러면 {@code @Transactional}이
 * 붙어 있는데도 <b>트랜잭션이 열리지 않는다</b>. 증상은 "가끔 정산 Row만 남는다" 같은 모양이라
 * 원인에 닿기 어렵다.
 *
 * <p>이 클래스는 <b>락 안에서 호출되는 것을 전제</b>한다. 혼자서는 이중 예약을 막지 못한다 —
 * 확인과 저장 사이에 남이 끼어들 수 있고, 그 직렬화는 호출자의 락이 담당한다.
 */
@Service
public class PaymentApprover {

    private final ReservationRequestService reservationRequestService;
    private final BookingRevalidator bookingRevalidator;
    private final ContractService contractService;
    private final SettlementService settlementService;
    private final PaymentGateway paymentGateway;
    private final PaymentRepository paymentRepository;
    private final PaymentFailureRecorder paymentFailureRecorder;

    public PaymentApprover(
            ReservationRequestService reservationRequestService,
            BookingRevalidator bookingRevalidator,
            ContractService contractService,
            SettlementService settlementService,
            PaymentGateway paymentGateway,
            PaymentRepository paymentRepository,
            PaymentFailureRecorder paymentFailureRecorder) {
        this.reservationRequestService = reservationRequestService;
        this.bookingRevalidator = bookingRevalidator;
        this.contractService = contractService;
        this.settlementService = settlementService;
        this.paymentGateway = paymentGateway;
        this.paymentRepository = paymentRepository;
        this.paymentFailureRecorder = paymentFailureRecorder;
    }

    @Transactional
    public PaymentConfirmResponse approve(long userId, Long reservationRequestId, PaymentConfirmRequest request) {
        Payment payment = paymentRepository
                .findByOrderId(request.orderId())
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "결제 준비 정보를 찾을 수 없습니다"));
        requireSameReservation(payment, reservationRequestId);

        ReservationRequestResponse reservation = reservationRequestService.snapshot(reservationRequestId);
        requireBrand(reservation, userId);

        // 2-0 계약 무결성 — 돈이 움직이기 직전에 한 번 확인한다. 값은 해시 1회 계산이다.
        contractService.assertIntact(reservationRequestId);
        // 2-1 상태 재확인
        requireNotPaid(reservation, reservationRequestId);
        // 2-2 ~ 2-4 기간 겹침 · 집기 가용량 · 도면과 전력 한도
        bookingRevalidator.revalidate(reservation);
        // 2-5 금액 대조 — 클라이언트가 보낸 금액을 그대로 승인하지 않는다
        requireAmountMatches(reservation, request, payment);

        // 2-6 PG 승인. 트랜잭션 안이며 타임아웃이 걸려 있다.
        PgApproval approval = approveOrRecordFailure(payment, request);

        // 2-7 결제·예약·정산을 같은 트랜잭션에서 확정한다 — 결제만 남고 정산 Row가 없는 상태를
        //     만들지 않는다.
        payment.approve(approval.paymentKey(), approval.approvedAt(), approval.rawResponse());
        reservationRequestService.markPaid(reservationRequestId);
        List<SettlementResponse> settlements = settlementService.createFor(payment.getId(), reservation);

        return new PaymentConfirmResponse(
                reservationRequestId,
                ReservationStatus.PAID,
                payment.getOrderId(),
                payment.getStatus(),
                payment.getAmount(),
                payment.getApprovedAt(),
                settlements);
    }

    /**
     * PG 실패를 상태로 남긴다. 거절과 타임아웃을 <b>다르게</b> 다루는 것이 요점이다.
     *
     * <p>타임아웃은 승인 여부를 모르는 상태라 {@code FAILED}로 적으면 "PG는 승인했는데 우리는
     * 실패로 안다"가 조용해진다. 두 경우 모두 예외를 던져 트랜잭션을 롤백시키지만, 기록은
     * 별도 트랜잭션으로 남긴다 — 롤백되면 흔적까지 사라지기 때문이다.
     */
    private PgApproval approveOrRecordFailure(Payment payment, PaymentConfirmRequest request) {
        try {
            return paymentGateway.approve(request.paymentKey(), request.orderId(), payment.getAmount());
        } catch (PaymentDeclinedException e) {
            paymentFailureRecorder.record(payment.getOrderId(), p -> p.fail(e.getRawResponse()));
            throw new ApiException(ErrorCode.PAYMENT_DECLINED, "결제가 거절되었습니다");
        } catch (PaymentGatewayTimeoutException e) {
            paymentFailureRecorder.record(
                    payment.getOrderId(), p -> p.markUnknown("PG 응답 없음(타임아웃): " + e.getMessage()));
            throw new ApiException(ErrorCode.PAYMENT_RESULT_UNKNOWN, "결제 결과를 확인할 수 없습니다. 잠시 후 결제 내역을 확인해 주세요");
        }
    }

    private static void requireBrand(ReservationRequestResponse reservation, long userId) {
        if (reservation.brandUserId() != userId) {
            throw new ApiException(ErrorCode.FORBIDDEN, "이 예약의 당사자가 아닙니다");
        }
    }

    private void requireNotPaid(ReservationRequestResponse reservation, Long reservationRequestId) {
        boolean alreadyPaid = reservation.status() == ReservationStatus.PAID
                || paymentRepository.existsByReservationRequestIdAndStatus(reservationRequestId, PaymentStatus.PAID);
        if (alreadyPaid) {
            throw new ApiException(ErrorCode.PAYMENT_ALREADY_COMPLETED, "이미 결제가 완료된 예약입니다");
        }
    }

    /**
     * 2-5 — 요청 금액·준비 금액·견적 스냅샷이 모두 같아야 한다.
     *
     * <p>준비 금액까지 대조하는 이유는 준비와 승인 사이에 견적이 바뀌었을 수 있기 때문이다.
     * 그 경우 사용자가 본 금액(준비 시점)과 서버가 승인할 금액(현재 견적)이 갈린다.
     */
    private static void requireAmountMatches(
            ReservationRequestResponse reservation, PaymentConfirmRequest request, Payment payment) {
        long expected = reservation.estimate().totalAmount();
        if (request.amount() != expected || payment.getAmount() != expected) {
            throw new ApiException(
                    ErrorCode.PAYMENT_AMOUNT_MISMATCH,
                    "결제 금액이 견적과 다릅니다 (요청 %d원, 준비 %d원, 견적 %d원)"
                            .formatted(request.amount(), payment.getAmount(), expected));
        }
    }

    private static void requireSameReservation(Payment payment, Long reservationRequestId) {
        if (!payment.getReservationRequestId().equals(reservationRequestId)) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED, "이 예약의 주문이 아닙니다");
        }
    }
}
