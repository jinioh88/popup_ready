package com.popupready.server.payment;

import io.swagger.v3.oas.annotations.media.Schema;

/** 결제 시도의 상태(스프린트 문서 §2.1). */
@Schema(description = "결제 상태")
public enum PaymentStatus {

    /** 결제 준비 완료(orderId 발급). 위젯이 뜬 상태이며 아직 승인되지 않았다 */
    READY,
    /** PG 승인 완료. <b>예약당 최대 1건</b>이며 락 + 상태 재확인이 그것을 보장한다 */
    PAID,
    /** PG가 거절했다 */
    FAILED,
    /** 결제 취소 */
    CANCELLED,
    /**
     * <b>PG 호출이 타임아웃되어 승인 여부를 서버가 모른다.</b>
     *
     * <p>{@code FAILED}로 적지 않는 이유는 "PG는 승인했는데 우리는 실패로 안다"가 조용해지기
     * 때문이다. 이 상태는 정직하게 모른다고 말하는 자리이며, 자동 대사(reconciliation)는
     * 이번 스프린트 범위가 아니다 — 수동 확인이 가능한 흔적을 남기는 것까지다(§2.1).
     */
    UNKNOWN
}
