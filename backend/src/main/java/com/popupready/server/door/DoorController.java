package com.popupready.server.door;

import com.popupready.server.auth.JwtPrincipal;
import com.popupready.server.common.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * 무인 스마트락 도어 오픈(US-301 백엔드 구간).
 *
 * <p>두 경로의 URL 접두가 서로 다르다 — 승인은 예약의 하위 리소스({@code /reservation-requests/{id}/door-open})이고
 * 마감은 이벤트 자체의 하위 리소스({@code /door-events/{eventId}/ack})다. 그래서 클래스 레벨
 * {@code @RequestMapping}을 두지 않고 메서드마다 전체 경로를 적는다.
 *
 * <p><b>백엔드는 MQTT 클라이언트를 갖지 않는다.</b> 발행은 모바일이 하고 서버는 토픽·페이로드를
 * 내려주기만 한다(§2.3 — CLAUDE.md의 모킹 구조 유지).
 *
 * <p>T4-3·T4-4 실구현. 경로·필드·상태 코드는 Phase 0에서 확정한 그대로이며 속만 채웠다.
 * 판정(당사자·결제·시간창)과 기록은 {@link DoorService}가 한다.
 */
@RestController
@RequestMapping(produces = MediaType.APPLICATION_JSON_VALUE)
@Tag(name = "door", description = "무인 스마트락 도어 오픈")
public class DoorController {

    private static final String ERROR_ENVELOPE_REF = "#/components/schemas/ApiErrorResponse";

    private final DoorService doorService;

    public DoorController(DoorService doorService) {
        this.doorService = doorService;
    }

    @Operation(
            operationId = "openDoor",
            summary = "도어 오픈 권한 검증·기록",
            description = "예약 당사자인지와 시간창(시작 10분 전 ~ 종료) 안인지를 서버가 판정하고, "
                    + "통과하면 발행할 MQTT 토픽과 페이로드를 내려준다. 판정 권위는 서버이며 클라이언트 시계를 보지 않는다.")
    @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "403",
            description = "당사자가 아니거나 시간창 밖 (DOOR_NOT_YET_OPENABLE)",
            content = @Content(schema = @Schema(ref = ERROR_ENVELOPE_REF)))
    @ResponseStatus(HttpStatus.CREATED)
    @PostMapping("/api/v1/reservation-requests/{id}/door-open")
    public ApiResponse<DoorOpenResponse> open(
            // 요청자는 본문이 아니라 토큰에서 온다 — 본문에서 받으면 남의 이름으로 문을 열 수 있다.
            @Parameter(hidden = true) @AuthenticationPrincipal JwtPrincipal principal,
            @Parameter(description = "예약 요청 ID", example = "45") @PathVariable Long id) {
        return ApiResponse.ok(doorService.open(principal.userId(), id));
    }

    @Operation(
            operationId = "ackDoorEvent",
            summary = "MQTT 발행 결과 보고",
            description = "모바일이 실제로 발행했는지를 보고해 이벤트를 DELIVERED 또는 FAILED로 마감한다. "
                    + "이 단계가 있어야 승인 기록이 전송 기록이 된다. 개방을 요청한 본인만 마감할 수 있다.")
    // 인가가 door-open과 같은 강도라는 것을 계약에도 드러낸다 — 남의 이벤트를 뒤집을 수 있으면
    // 전송 기록을 위조하는 경로가 된다.
    @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "403",
            description = "이 도어 이벤트의 요청자가 아님",
            content = @Content(schema = @Schema(ref = ERROR_ENVELOPE_REF)))
    @ResponseStatus(HttpStatus.OK)
    @PostMapping("/api/v1/door-events/{eventId}/ack")
    public ApiResponse<DoorAckResponse> ack(
            @Parameter(hidden = true) @AuthenticationPrincipal JwtPrincipal principal,
            @Parameter(description = "도어 이벤트 ID", example = "123") @PathVariable Long eventId,
            @Valid @RequestBody DoorAckRequest request) {
        return ApiResponse.ok(doorService.ack(principal.userId(), eventId, Boolean.TRUE.equals(request.success())));
    }
}
