package com.popupready.server.common;

import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import org.springframework.http.MediaType;

/**
 * 필터 단계에서 응답 봉투를 직접 써야 할 때 쓰는 도우미.
 *
 * <p>컨트롤러 밖(Security 필터)에서 발생하는 401·403은 {@link GlobalExceptionHandler}가 잡지 못해
 * 메시지 컨버터를 거치지 않는다. 그렇다고 봉투를 벗기면 클라이언트가 이 두 경우만 다르게 처리해야 한다.
 *
 * <p><b>ObjectMapper를 주입받지 않고 문자열로 조립한다.</b> Boot 4 컨텍스트에는 {@code ObjectMapper}
 * 빈이 올라오지 않고(슬라이스뿐 아니라 전체 컨텍스트에서도 그렇다), 여기서 내보내는 봉투는 코드와
 * 고정 문구만 담는 두 가지 형태뿐이라 직렬화기를 끌어올 이유가 없다. 덤으로 필터 단계에서
 * 직렬화가 실패할 경로가 사라진다.
 */
final class ApiErrorWriter {

    private ApiErrorWriter() {}

    static void write(HttpServletResponse response, ErrorCode errorCode, String message) throws IOException {
        response.setStatus(errorCode.status().value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.getWriter()
                .write("{\"data\":null,\"error\":{\"code\":\"%s\",\"message\":\"%s\"}}"
                        .formatted(errorCode.name(), escape(message)));
    }

    /** 메시지는 코드에 박힌 고정 문구뿐이지만, 나중에 값이 섞여 들어와도 봉투가 깨지지 않게 막아둔다. */
    private static String escape(String value) {
        return value.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
