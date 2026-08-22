package com.popupready.server.common;

import lombok.Getter;

/**
 * 도메인 규칙 위반을 공유 에러 코드와 함께 알린다.
 *
 * <p>상태 코드는 {@link ErrorCode}가 이미 알고 있으므로 던지는 쪽은 코드와 메시지만 정하면 된다.
 * 메시지는 사람이 읽는 설명이고, 클라이언트의 분기 조건은 언제나 코드다.
 */
@Getter
public class ApiException extends RuntimeException {

    private final ErrorCode errorCode;

    public ApiException(ErrorCode errorCode, String message) {
        super(message);
        this.errorCode = errorCode;
    }
}
