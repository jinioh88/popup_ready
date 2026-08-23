package com.popupready.server.reservation;

import java.time.LocalDate;

/**
 * 계약 바인딩에 필요한 예약 정보만 추린 읽기 모델.
 *
 * <p>{@code contract}는 이 도메인의 엔티티나 리포지토리를 보지 않는다(패키지 경계 규칙).
 * API 응답 DTO를 넘기지 않는 이유는 그쪽이 견적 breakdown을 계산해 담는 <b>웹용</b> 형식이기
 * 때문이다 — 도메인 간 계약은 따로 두는 편이 서로의 변경에 덜 끌려다닌다.
 *
 * <p>금액은 <b>저장된 값 그대로</b>다. 계약 바인딩 시점에 다시 계산하면 그 사이 단가가 바뀌었을 때
 * 계약서 금액과 예약 금액이 갈라진다.
 */
public record ReservationParties(
        Long reservationRequestId,
        Long spaceId,
        Long brandUserId,
        LocalDate startDate,
        LocalDate endDate,
        int days,
        long spaceRentTotal,
        long deposit,
        long totalAmount) {}
