package com.popupready.server.payment;

import com.popupready.server.reservation.BookingRevalidator;
import com.popupready.server.reservation.ReservationRequestResponse;
import java.util.ArrayList;
import java.util.List;

/**
 * 결제 승인이 잡아야 할 락 키(§2.2-C 1단계, 2026-08-23 교정).
 *
 * <p>키를 만드는 곳을 한 군데로 모은다 — 두 곳에서 만들면 한쪽만 고쳐져 서로 다른 키를 잡고,
 * 그러면 락이 있는데 아무것도 직렬화되지 않는 상태가 된다.
 */
public final class PaymentLockKeys {

    private static final String SPACE_PREFIX = "lock:space:";

    private static final String FIXTURE_PREFIX = "lock:fixture:";

    private PaymentLockKeys() {}

    /**
     * 공간 락 + 배치된 집기별 락.
     *
     * <p>공간 락에 <b>기간이 없는 것</b>이 요점이다. 기간이 키에 들어가면 겹치는 기간의 두 요청이
     * 서로 다른 락을 잡아 "기간 겹침 재확인"을 나란히 통과한다.
     *
     * <p>집기 락이 <b>따로 필요한 것</b>도 요점이다. 집기는 공간에 매이지 않으므로 서로 다른
     * 공간의 두 예약이 같은 집기의 마지막 1개를 동시에 가져갈 수 있다.
     */
    public static List<String> of(ReservationRequestResponse reservation) {
        List<String> keys = new ArrayList<>();
        keys.add(SPACE_PREFIX + reservation.spaceId());
        BookingRevalidator.placedFixtureIds(reservation).forEach(id -> keys.add(FIXTURE_PREFIX + id));
        return List.copyOf(keys);
    }
}
