package com.popupready.server.space;

import io.swagger.v3.oas.annotations.media.Schema;

/** 공간의 노출 상태. INACTIVE는 검색 결과에서 제외된다. */
@Schema(description = "공간 상태")
public enum SpaceStatus {
    ACTIVE,
    INACTIVE
}
