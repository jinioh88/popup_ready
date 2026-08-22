package com.popupready.server.fixture;

import io.swagger.v3.oas.annotations.media.Schema;

/** 집기 분류(스프린트 문서 §2.1). 빌더의 라이브러리 패널 탭이 이 값으로 나뉜다. */
@Schema(description = "집기 분류")
public enum FixtureCategory {

    /** 행거 — 의류 진열 */
    HANGER,
    /** POS 단말 */
    POS,
    /** 쇼케이스 — 유리 진열장 */
    SHOWCASE,
    /** 조명 */
    LIGHTING,
    /** 진열대 */
    SHELF,
    /** 그 외 */
    ETC
}
