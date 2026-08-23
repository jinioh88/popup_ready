package com.popupready.server.settlement;

/**
 * 예약의 승인된 결제를 찾는 창구.
 *
 * <p>{@code settlement}가 {@code payment}의 리포지토리를 직접 보지 않게 하려고 둔 경계다 —
 * 인터페이스로 뺀 이유는 <b>방향</b> 때문이다. 결제가 정산을 부르는데(2-7) 정산이 결제 서비스를
 * 되부르면 순환 의존이 된다. 구현은 {@code payment} 쪽에 두고 여기서는 필요한 한 가지만 요구한다.
 */
public interface PaidPaymentLookup {

    /** 예약당 PAID는 최대 1건이다. 없으면 null. */
    Long paidPaymentIdOf(Long reservationRequestId);
}
