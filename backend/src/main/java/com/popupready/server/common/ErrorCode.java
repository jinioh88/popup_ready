package com.popupready.server.common;

import org.springframework.http.HttpStatus;

/**
 * 웹/모바일과 공유하는 에러 코드 목록. 클라이언트는 이 이름으로 분기하므로
 * 상수 이름 변경은 API 계약 변경이다 — 스프린트 문서 갱신 + PM 보고가 함께 가야 한다.
 */
public enum ErrorCode {

    // 공통
    VALIDATION_FAILED(HttpStatus.BAD_REQUEST),
    UNAUTHORIZED(HttpStatus.UNAUTHORIZED),
    FORBIDDEN(HttpStatus.FORBIDDEN),
    NOT_FOUND(HttpStatus.NOT_FOUND),
    METHOD_NOT_ALLOWED(HttpStatus.METHOD_NOT_ALLOWED),
    UNSUPPORTED_MEDIA_TYPE(HttpStatus.UNSUPPORTED_MEDIA_TYPE),
    INTERNAL_ERROR(HttpStatus.INTERNAL_SERVER_ERROR),

    // auth
    EMAIL_ALREADY_EXISTS(HttpStatus.CONFLICT),
    INVALID_CREDENTIALS(HttpStatus.UNAUTHORIZED),

    // space / fixture
    SPACE_NOT_FOUND(HttpStatus.NOT_FOUND),
    FIXTURE_NOT_FOUND(HttpStatus.NOT_FOUND),

    // reservation
    RESERVATION_REQUEST_NOT_FOUND(HttpStatus.NOT_FOUND),
    LAYOUT_OUT_OF_BOUNDS(HttpStatus.BAD_REQUEST),
    LAYOUT_OVERLAP(HttpStatus.BAD_REQUEST),
    FIXTURE_STOCK_EXCEEDED(HttpStatus.BAD_REQUEST),

    // contract
    CONTRACT_NOT_FOUND(HttpStatus.NOT_FOUND),
    NOT_CONTRACT_PARTY(HttpStatus.FORBIDDEN),
    // 예약 하나에 계약은 하나다. 생성을 멱등으로 만들지 않고 이 코드를 내는 이유는, 조용히 기존
    // 계약을 돌려주면 더블 서브밋 버그가 정상 동작으로 위장되기 때문이다. 웹은 이 코드를 보면
    // GET /reservation-requests/{id}/contract로 넘어간다.
    CONTRACT_ALREADY_EXISTS(HttpStatus.CONFLICT),
    CONTRACT_ALREADY_SIGNED(HttpStatus.CONFLICT);

    private final HttpStatus status;

    ErrorCode(HttpStatus status) {
        this.status = status;
    }

    public HttpStatus status() {
        return status;
    }
}
