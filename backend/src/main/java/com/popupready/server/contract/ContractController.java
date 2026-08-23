package com.popupready.server.contract;

import com.popupready.server.auth.JwtPrincipal;
import com.popupready.server.common.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * 일시사용 표준 계약 API(US-202).
 *
 * <p><b>법률 세이프가드</b>: 계약 명칭 "단기 공간사용 제휴계약"과 필수 조항은
 * {@code contract/template-v1.json}이 원본이며 임의로 바꾸지 않는다. 상가건물 임대차보호법상
 * 일시사용 임대차 요건을 벗어나면 계약갱신요구권 배제가 무너진다(변경 시 PM 협의).
 *
 * <p>당사자 판정은 {@link ContractService}가 한다 — 계약은 브랜드와 건물주 <b>양쪽</b>이
 * 접근하므로 역할로 가를 수 없고, Security 설정은 인증까지만 본다.
 */
@RestController
@Tag(name = "contract", description = "일시사용 표준 계약(US-202)")
@RequestMapping(produces = MediaType.APPLICATION_JSON_VALUE)
public class ContractController {

    private final ContractService contractService;

    public ContractController(ContractService contractService) {
        this.contractService = contractService;
    }

    @Operation(
            summary = "계약서 생성",
            description = "예약 요청 데이터를 표준 템플릿에 바인딩해 조항 전문을 스냅샷으로 저장한다. "
                    + "예약 요청 상태는 CONTRACT_PENDING으로 전이된다. "
                    + "예약 하나에 계약은 하나이며, 이미 있으면 409다 — 그때는 조회 API로 기존 계약을 가져간다.")
    @PostMapping("/api/v1/reservation-requests/{id}/contract")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<ContractResponse> create(
            @Parameter(description = "예약 요청 ID", example = "1") @PathVariable Long id) {
        return ApiResponse.ok(contractService.create(id));
    }

    @Operation(
            summary = "예약 요청의 계약 조회",
            description = "예약 요청에 딸린 계약을 가져온다. 아직 없으면 404다. "
                    + "빌더에서 계약 단계로 재진입할 때(새로고침·서명 링크 재방문) 계약 ID를 모르는 채로 "
                    + "기존 계약을 되찾기 위한 경로다.")
    @GetMapping("/api/v1/reservation-requests/{id}/contract")
    public ApiResponse<ContractResponse> findByReservation(
            @Parameter(description = "예약 요청 ID", example = "1") @PathVariable Long id) {
        return ApiResponse.ok(contractService.findByReservation(id));
    }

    @Operation(
            summary = "전자 서명",
            description = "로그인 사용자가 해당 계약의 당사자인지 확인한 뒤 서명 시각을 기록한다. "
                    + "양측이 모두 서명하면 계약은 SIGNED, 예약 요청은 CONTRACT_SIGNED가 된다. "
                    + "당사자가 아니면 403, 이미 서명했으면 409다.")
    @PostMapping("/api/v1/contracts/{id}/sign")
    public ApiResponse<ContractResponse> sign(
            @Parameter(description = "계약 ID", example = "1") @PathVariable Long id,
            // 서명자는 본문이 아니라 토큰에서 온다 — 본문에서 받으면 남의 이름으로 서명할 수 있다.
            @Parameter(hidden = true) @AuthenticationPrincipal JwtPrincipal principal) {
        return ApiResponse.ok(contractService.sign(id, principal.userId()));
    }

    @Operation(summary = "계약 열람", description = "조항 전문·서명 시각·무결성 해시를 돌려준다. 분쟁 시 소명 자료 경로다. " + "당사자에게만 열린다.")
    @GetMapping("/api/v1/contracts/{id}")
    public ApiResponse<ContractResponse> detail(
            @Parameter(description = "계약 ID", example = "1") @PathVariable Long id,
            @Parameter(hidden = true) @AuthenticationPrincipal JwtPrincipal principal) {
        return ApiResponse.ok(contractService.detail(id, principal.userId()));
    }
}
