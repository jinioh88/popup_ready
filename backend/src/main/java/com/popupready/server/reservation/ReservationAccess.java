package com.popupready.server.reservation;

import java.time.LocalDate;

/**
 * 도어 개방 판정에 필요한 예약 정보만 추린 읽기 모델(US-301).
 *
 * <p>{@link ReservationParties}(계약 바인딩용)와 나눈 이유는 필요한 축이 다르기 때문이다 —
 * 계약은 금액과 당사자 이름을 보고, 도어는 <b>상태와 기간</b>을 본다. 한 record에 합치면 쓰는 쪽마다
 * 절반은 안 쓰는 필드를 들고 다닌다.
 */
public record ReservationAccess(
        Long id, Long spaceId, Long brandUserId, LocalDate startDate, LocalDate endDate, ReservationStatus status) {}
