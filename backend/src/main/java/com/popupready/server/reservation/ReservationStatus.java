package com.popupready.server.reservation;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 예약 요청 상태(스프린트 문서 §2.1). Sprint 1 범위는 DRAFT → CONTRACT_PENDING →
 * CONTRACT_SIGNED까지이며, 결제 상태(PAID 등)는 Sprint 2에서 이 뒤에 붙는다.
 */
@Schema(description = "예약 요청 상태")
public enum ReservationStatus {

    /** 예약 요청 생성 직후 — 계약서가 아직 만들어지지 않았다 */
    DRAFT,
    /** 계약서 생성 완료, 서명 대기 */
    CONTRACT_PENDING,
    /** 양 당사자 서명 완료 */
    CONTRACT_SIGNED
}
