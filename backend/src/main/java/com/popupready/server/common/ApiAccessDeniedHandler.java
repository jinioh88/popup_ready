package com.popupready.server.common;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;

/** 인증은 됐지만 권한이 모자랄 때 403을 응답 봉투 형태로 돌려준다. */
@Component
public class ApiAccessDeniedHandler implements AccessDeniedHandler {

    @Override
    public void handle(
            HttpServletRequest request, HttpServletResponse response, AccessDeniedException accessDeniedException)
            throws IOException {
        ApiErrorWriter.write(response, ErrorCode.FORBIDDEN, "권한이 없습니다");
    }
}
