package com.popupready.server.reservation;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 예약 요청 상태(스프린트 문서 §2.1).
 *
 * <pre>
 * DRAFT → CONTRACT_PENDING → CONTRACT_SIGNED → PAYMENT_PENDING → PAID → CANCELLED
 * </pre>
 *
 * <p><b>자리를 실제로 잡는 것은 {@code PAID}뿐이다.</b> 날짜별 집기 가용량과 기간 겹침 판정이
 * 모두 이 상태만 센다 — 결제 전 예약이 자리를 잡으면 결제하지 않은 요청이 남의 예약을 막는다.
 */
@Schema(description = "예약 요청 상태")
public enum ReservationStatus {

    /** 예약 요청 생성 직후 — 계약서가 아직 만들어지지 않았다 */
    DRAFT,
    /** 계약서 생성 완료, 서명 대기 */
    CONTRACT_PENDING,
    /** 양 당사자 서명 완료 */
    CONTRACT_SIGNED,
    /** 결제 준비됨(주문 발급). <b>아직 자리를 잡은 것이 아니다</b> — 가용량 계산에서 세지 않는다 */
    PAYMENT_PENDING,
    /** 결제 승인 완료. 이 상태만 공간·집기를 실제로 점유한다 */
    PAID,
    /** 취소됨 */
    CANCELLED
}
