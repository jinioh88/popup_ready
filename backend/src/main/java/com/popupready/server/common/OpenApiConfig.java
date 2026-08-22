package com.popupready.server.common;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.media.Content;
import io.swagger.v3.oas.models.media.MediaType;
import io.swagger.v3.oas.models.media.ObjectSchema;
import io.swagger.v3.oas.models.media.Schema;
import io.swagger.v3.oas.models.responses.ApiResponses;
import io.swagger.v3.oas.models.security.SecurityScheme;
import io.swagger.v3.oas.models.servers.Server;
import java.util.List;
import org.springdoc.core.customizers.OpenApiCustomizer;
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

    /** 실패 응답 봉투 스키마 이름. 웹·모바일은 이 스키마로 에러 처리 타입을 생성한다. */
    private static final String ERROR_ENVELOPE_SCHEMA = "ApiErrorResponse";

    private static final String ERROR_ENVELOPE_REF = "#/components/schemas/" + ERROR_ENVELOPE_SCHEMA;

    /**
     * 실패 경로도 계약이다. 컨트롤러 시그니처만으로는 성공 응답밖에 문서화되지 않아,
     * {@link GlobalExceptionHandler}가 실제로 내보내는 400·500 봉투를 모든 오퍼레이션에 얹는다.
     *
     * <p>인증이 붙는 Phase 2(T2-2)에서 보호 엔드포인트에 401을 같은 방식으로 추가한다.
     */
    @Bean
    public OpenApiCustomizer errorResponseCustomizer() {
        return openApi -> {
            openApi.getComponents().addSchemas(ERROR_ENVELOPE_SCHEMA, errorEnvelopeSchema());
            openApi.getPaths().values().stream()
                    .flatMap(pathItem -> pathItem.readOperations().stream())
                    .forEach(operation -> {
                        ApiResponses responses = operation.getResponses();
                        responses.addApiResponse("400", errorResponse("요청 값 검증 실패"));
                        responses.addApiResponse("500", errorResponse("서버 오류"));
                    });
        };
    }

    private Schema<?> errorEnvelopeSchema() {
        return new ObjectSchema()
                .description("실패 응답 봉투. data는 항상 null이고 error에 코드·메시지가 담긴다.")
                .addProperty("data", new Schema<>().description("실패 시 항상 null"))
                .addProperty("error", new Schema<>().$ref("#/components/schemas/ApiError"));
    }

    private io.swagger.v3.oas.models.responses.ApiResponse errorResponse(String description) {
        return new io.swagger.v3.oas.models.responses.ApiResponse()
                .description(description)
                .content(new Content()
                        .addMediaType(
                                "application/json",
                                new MediaType().schema(new Schema<>().$ref(ERROR_ENVELOPE_REF))));
    }
}
