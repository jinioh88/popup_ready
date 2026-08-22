package com.popupready.server.contract;

import com.popupready.server.common.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.time.Instant;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * ⚠️ Phase 0 계약 스텁 — 고정 샘플을 돌려준다(US-202).
 *
 * <p>실구현(T5-1~T5-3)에서 템플릿 치환·SHA-256 해시·당사자 검증이 들어온다. 조항 샘플은
 * 웹이 열람 화면을 먼저 만들 수 있도록 실제 필수 조항의 형태를 그대로 흉내낸 것이다.
 *
 * <p><b>법률 세이프가드</b>: 계약 명칭은 "단기 공간사용 제휴계약"으로 고정한다. 상가임대차보호법상
 * 일시사용 임대차 요건을 벗어나면 계약갱신요구권 배제가 무너지므로, 명칭과 필수 조항은 임의로
 * 바꾸지 않는다(변경 시 PM 협의).
 */
@RestController
@Tag(name = "contract", description = "일시사용 표준 계약(US-202)")
@RequestMapping(produces = MediaType.APPLICATION_JSON_VALUE)
public class ContractController {

    /** 임의 변경 금지. T5-1에서 템플릿 리소스로 옮기되 값은 그대로 유지한다. */
    public static final String CONTRACT_TITLE = "단기 공간사용 제휴계약";

    private static final String TEMPLATE_VERSION = "v1";

    private static final String STUB_CONTENT_HASH =
            "3f2b7c1d9a4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8";

    private static final Long STUB_CONTRACT_ID = 1L;

    @Operation(
            summary = "계약서 생성",
            description = "예약 요청 데이터를 표준 템플릿에 바인딩해 조항 전문을 스냅샷으로 저장한다. "
                    + "예약 요청 상태는 CONTRACT_PENDING으로 전이된다.")
    @PostMapping("/api/v1/reservation-requests/{id}/contract")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<ContractResponse> create(
            @Parameter(description = "예약 요청 ID", example = "1") @PathVariable Long id) {
        return ApiResponse.ok(new ContractResponse(
                STUB_CONTRACT_ID,
                id,
                CONTRACT_TITLE,
                TEMPLATE_VERSION,
                sampleClauses(),
                STUB_CONTENT_HASH,
                null,
                null,
                ContractStatus.PENDING));
    }

    @Operation(
            summary = "전자 서명",
            description = "로그인 사용자가 해당 계약의 당사자인지 확인한 뒤 서명 시각을 기록한다. "
                    + "양측이 모두 서명하면 계약은 SIGNED, 예약 요청은 CONTRACT_SIGNED가 된다.")
    @PostMapping("/api/v1/contracts/{id}/sign")
    public ApiResponse<ContractResponse> sign(
            @Parameter(description = "계약 ID", example = "1") @PathVariable Long id) {
        return ApiResponse.ok(signedSample(id));
    }

    @Operation(summary = "계약 열람", description = "조항 전문·서명 시각·무결성 해시를 돌려준다. 분쟁 시 소명 자료 경로다.")
    @GetMapping("/api/v1/contracts/{id}")
    public ApiResponse<ContractResponse> detail(
            @Parameter(description = "계약 ID", example = "1") @PathVariable Long id) {
        return ApiResponse.ok(signedSample(id));
    }

    /** 열람·서명 응답의 대표 샘플은 양측 서명이 끝난 계약이다 — 소명 자료 화면이 이 상태를 다룬다. */
    private ContractResponse signedSample(Long id) {
        return new ContractResponse(
                id,
                1L,
                CONTRACT_TITLE,
                TEMPLATE_VERSION,
                sampleClauses(),
                STUB_CONTENT_HASH,
                Instant.parse("2026-08-22T05:12:31Z"),
                Instant.parse("2026-08-22T06:40:02Z"),
                ContractStatus.SIGNED);
    }

    /**
     * 필수 조항 4종의 형태 샘플. 실제 문구는 T5-1의 템플릿 리소스가 원본이 되며, 여기 문구를
     * 계약 원문으로 인용하면 안 된다.
     */
    private List<ClauseDto> sampleClauses() {
        return List.of(
                new ClauseDto("제1조 (목적)", "본 계약은 팝업스토어의 단기 운영을 목적으로 하는 일시사용에 관한 것으로, 통상의 상가 임대차와 그 성질을 달리한다."),
                new ClauseDto("제2조 (사용 기간)", "사용 기간은 2026-09-01부터 2026-09-14까지 14일간으로 하며, 기간 만료로 본 계약은 당연히 종료된다."),
                new ClauseDto(
                        "제3조 (계약갱신요구권 불행사)",
                        "사용자는 본 계약이 상가건물 임대차보호법상 일시사용을 위한 것임을 확인하고, 동법에 따른 계약갱신요구권을 행사하지 아니한다."),
                new ClauseDto("제4조 (보증금 및 정산)", "보증금은 공간 사용료 대비 소액으로 정하며, 사용료는 정액 일시불로 정산한다."),
                new ClauseDto("제5조 (원상 유지)", "사용자는 시공·못질 등 구조를 변경하는 행위를 하지 아니하며, 반입 물품은 모듈러 집기로 한정한다."));
    }
}
