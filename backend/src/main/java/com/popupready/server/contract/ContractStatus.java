package com.popupready.server.contract;

import io.swagger.v3.oas.annotations.media.Schema;

/** 계약 상태. 양 당사자가 모두 서명해야 SIGNED가 된다. */
@Schema(description = "계약 상태")
public enum ContractStatus {

    /** 생성 완료, 서명 대기(한쪽만 서명한 상태도 여기에 머문다) */
    PENDING,
    /** 양 당사자 서명 완료 */
    SIGNED
}
