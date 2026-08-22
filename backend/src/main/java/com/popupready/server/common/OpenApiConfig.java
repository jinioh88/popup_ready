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
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
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
                        .description("단기 팝업스토어 턴키 예약·무인 운영 플랫폼 API. " + "모든 응답은 {data, error} 봉투로 감싸진다."))
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
            rewriteNullableRefs(openApi);
        };
    }

    /**
     * swagger-core는 {@code $ref} 속성에 nullable을 적용할 때 형제 키로 {@code "type": "null"}을 붙인다.
     * OpenAPI 3.1(JSON Schema)에서 형제 키워드는 AND로 해석되므로 "null이면서 동시에 AuthResponse"라는,
     * 어떤 값도 통과하지 못하는 스키마가 된다. 웹·모바일이 이 파일로 타입을 만드는 이상 그대로 둘 수 없어
     * {@code anyOf: [{$ref}, {type: null}]}로 바로잡는다.
     *
     * <p>{@code $ref}가 아닌 속성(배열 등)은 swagger-core가 {@code type: ["array", "null"]}로 이미
     * 올바르게 내보내므로 건드리지 않는다.
     */
    @SuppressWarnings("rawtypes")
    private void rewriteNullableRefs(OpenAPI openApi) {
        for (Schema<?> schema : openApi.getComponents().getSchemas().values()) {
            Map<String, Schema> properties = schema.getProperties();
            if (properties != null) {
                properties.replaceAll((name, property) -> toNullableUnion(property));
            }
        }
    }

    @SuppressWarnings({"rawtypes", "unchecked"})
    private Schema toNullableUnion(Schema property) {
        boolean nullableRef = property.get$ref() != null
                && property.getTypes() != null
                && property.getTypes().contains("null");
        if (!nullableRef) {
            return property;
        }
        return new Schema<>()
                .description(property.getDescription())
                .anyOf(List.of(new Schema<>().$ref(property.get$ref()), nullSchema()));
    }

    private Schema<?> errorEnvelopeSchema() {
        return new ObjectSchema()
                .description("실패 응답 봉투. data는 항상 null이고 error에 코드·메시지가 담긴다.")
                .addProperty("data", new Schema<>().description("실패 시 항상 null").nullable(true))
                .addProperty("error", new Schema<>().$ref("#/components/schemas/ApiError"))
                .required(List.of("data", "error"));
    }

    /**
     * {@code {"type": "null"}} 스키마. 3.1 모드에서는 {@code type} 단수 setter가 무시되므로
     * {@code types}에 직접 넣어야 한다 — 빠뜨리면 빈 스키마 {@code {}}가 나가 "무엇이든 허용"이 된다.
     */
    private Schema<?> nullSchema() {
        Schema<?> schema = new Schema<>();
        schema.setTypes(new LinkedHashSet<>(List.of("null")));
        return schema;
    }

    private io.swagger.v3.oas.models.responses.ApiResponse errorResponse(String description) {
        return new io.swagger.v3.oas.models.responses.ApiResponse()
                .description(description)
                .content(new Content()
                        .addMediaType(
                                "application/json", new MediaType().schema(new Schema<>().$ref(ERROR_ENVELOPE_REF))));
    }
}
