package com.popupready.server.door;

import com.popupready.server.common.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.time.Instant;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
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
 * <p>Phase 0 스텁이다. 권한·시간창 판정과 이벤트 기록은 Phase 4에서 채운다.
 */
@RestController
@RequestMapping(produces = MediaType.APPLICATION_JSON_VALUE)
@Tag(name = "door", description = "무인 스마트락 도어 오픈")
public class DoorController {

    private static final String ERROR_ENVELOPE_REF = "#/components/schemas/ApiErrorResponse";

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
            @Parameter(description = "예약 요청 ID", example = "45") @PathVariable Long id) {
        // Phase 0 스텁 — T4-3에서 실구현.
        return ApiResponse.ok(new DoorOpenResponse(
                123L,
                "popupready/locks/1/command",
                "popupready/locks/1/status",
                new DoorCommandPayload(123L, id, "OPEN", Instant.parse("2026-09-01T09:50:00Z")),
                DoorEventStatus.AUTHORIZED));
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
            @Parameter(description = "도어 이벤트 ID", example = "123") @PathVariable Long eventId,
            @Valid @RequestBody DoorAckRequest request) {
        // Phase 0 스텁 — T4-4에서 실구현.
        return ApiResponse.ok(new DoorAckResponse(
                eventId,
                Boolean.TRUE.equals(request.success()) ? DoorEventStatus.DELIVERED : DoorEventStatus.FAILED,
                Instant.parse("2026-09-01T09:50:02Z")));
    }
}
