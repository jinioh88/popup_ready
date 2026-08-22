package com.popupready.server.auth;

/**
 * 토큰이 만료·위조·훼손되어 신뢰할 수 없다.
 *
 * <p><b>거부 사유를 구분해 알려주지 않는다.</b> "만료됨"과 "서명 불일치"를 구분해 주면 공격자에게
 * 키 추측의 단서가 된다. 클라이언트는 어느 쪽이든 재로그인하면 되므로 구분할 실익도 없다.
 */
public class InvalidTokenException extends RuntimeException {

    public InvalidTokenException(String message, Throwable cause) {
        super(message, cause);
    }
}
