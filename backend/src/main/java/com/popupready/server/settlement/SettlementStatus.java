package com.popupready.server.settlement;

import io.swagger.v3.oas.annotations.media.Schema;

/** 분할 정산 Row의 상태(스프린트 문서 §2.1). */
@Schema(description = "분할 정산 Row 상태")
public enum SettlementStatus {

    /** 생성 직후. Sprint 3의 US-403 배치가 훑을 대상이다 */
    PENDING,
    /**
     * 보증금 전용 상태. 에스크로로 <b>격리 기록</b>된다 — 실제 신탁 계좌가 아니라 DB 상태 격리이며
     * 실계좌 연동은 MVP 밖이다(스프린트 문서 §1).
     */
    ESCROW_HELD,
    /** 정산 승인됨 */
    APPROVED,
    /** 이체 완료. Sprint 3 배치가 settledAt과 함께 채운다 */
    TRANSFERRED
}
