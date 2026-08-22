package com.popupready.server.common;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.stereotype.Component;

/**
 * 인증이 필요한데 없을 때 401을 <b>응답 봉투 형태로</b> 돌려준다.
 *
 * <p>Security의 기본 동작은 봉투 없는 빈 401이라, 클라이언트의 에러 처리 분기가 여기서만 달라진다.
 */
@Component
public class ApiAuthenticationEntryPoint implements AuthenticationEntryPoint {

    @Override
    public void commence(
            HttpServletRequest request, HttpServletResponse response, AuthenticationException authException)
            throws IOException {
        // 사유(토큰 없음/만료/위조)를 구분해 알려주지 않는다 — 공격자에게 단서가 된다.
        ApiErrorWriter.write(response, ErrorCode.UNAUTHORIZED, "인증이 필요합니다");
    }
}
