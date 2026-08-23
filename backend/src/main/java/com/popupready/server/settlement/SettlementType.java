package com.popupready.server.settlement;

import io.swagger.v3.oas.annotations.media.Schema;

/** 분할 정산 Row의 종류(스프린트 문서 §2.1). 값 추가·이름 변경은 API 계약 변경이다. */
@Schema(description = "분할 정산 Row 종류")
public enum SettlementType {

    /** 공간 대여료 → 건물주(space.ownerId) */
    SPACE_RENT,
    /** 집기 렌털료 → 가구사(fixture.vendorId). <b>공급사별로 Row가 나뉜다.</b> */
    FIXTURE_RENTAL,
    /** 보증금 → 브랜드. 정산 대상이 아니라 <b>반환 대상</b>이며 US-403 배치가 환불한다. */
    DEPOSIT,
    /**
     * 플랫폼 수수료. gross는 각 payee Row에서 원천 차감한 수수료의 합이고 net은 0이다 —
     * 플랫폼은 결제 전액을 수납한 뒤 각 payee에게 net만 내보내고 나머지를 남기므로
     * 자기에게 이체할 순액이 없다.
     */
    PLATFORM_FEE
}
