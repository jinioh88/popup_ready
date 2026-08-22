package com.popupready.server.common;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityScheme;
import io.swagger.v3.oas.models.servers.Server;
import java.util.List;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * springdoc 설정. 이 설정으로 생성되는 /v3/api-docs 출력이 저장소 루트
 * contracts/openapi.json으로 커밋되며, 웹·모바일은 그 파일로 타입을 생성한다.
 * 따라서 여기 손대는 것은 파트 간 계약을 건드리는 일이다.
 */
@Configuration
public class OpenApiConfig {

    /** 보호된 엔드포인트는 컨트롤러에 @SecurityRequirement(name = BEARER_AUTH)를 붙여 표시한다. */
    public static final String BEARER_AUTH = "bearerAuth";

    @Bean
    public OpenAPI popupReadyOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("PopupReady API")
                        .version("v1")
                        .description("단기 팝업스토어 턴키 예약·무인 운영 플랫폼 API. "
                                + "모든 응답은 {data, error} 봉투로 감싸진다."))
                .servers(List.of(new Server().url("http://localhost:8080").description("로컬 개발")))
                .components(new Components()
                        .addSecuritySchemes(
                                BEARER_AUTH,
                                new SecurityScheme()
                                        .type(SecurityScheme.Type.HTTP)
                                        .scheme("bearer")
                                        .bearerFormat("JWT")
                                        .description("로그인 응답의 accessToken을 Bearer로 전달")));
    }
}
