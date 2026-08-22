package com.popupready.server.auth;

import io.swagger.v3.oas.annotations.media.Schema;

/** 사용자 역할(스프린트 문서 §2.1). 값 추가·이름 변경은 API 계약 변경이다. */
@Schema(description = "사용자 역할")
public enum UserRole {

    /** 팝업스토어를 여는 브랜드 운영자 — 공간 탐색·빌더·예약 요청의 주체 */
    BRAND,
    /** 공실을 등록하는 건물주 — 계약의 상대 당사자 */
    LANDLORD,
    /** 모듈러 집기 공급사 */
    VENDOR,
    /** 운영 관리자 */
    ADMIN
}
