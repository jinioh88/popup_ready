package com.popupready.server.contract;

import com.popupready.server.common.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.time.Instant;
import java.time.LocalDate;
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
 * <p>T5-1에서 템플릿·치환이 실물로 들어왔다 — 샘플 조항은 이제 흉내가 아니라 <b>실제
 * {@code contract/template-v1.json}을 고정 예시 값으로 바인딩한 결과</b>다. 남은 스텁은 저장·조회·
 * 당사자 검증(T5-2·T5-3)이다.
 *
 * <p><b>법률 세이프가드</b>: 계약 명칭은 "단기 공간사용 제휴계약"으로 고정한다. 상가임대차보호법상
 * 일시사용 임대차 요건을 벗어나면 계약갱신요구권 배제가 무너지므로, 명칭과 필수 조항은 임의로
 * 바꾸지 않는다(변경 시 PM 협의).
 */
@RestController
@Tag(name = "contract", description = "일시사용 표준 계약(US-202)")
@RequestMapping(produces = MediaType.APPLICATION_JSON_VALUE)
public class ContractController {

    private static final String STUB_CONTENT_HASH = "3f2b7c1d9a4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8";

    private static final Long STUB_CONTRACT_ID = 1L;

    @Operation(
            summary = "계약서 생성",
            description = "예약 요청 데이터를 표준 템플릿에 바인딩해 조항 전문을 스냅샷으로 저장한다. " + "예약 요청 상태는 CONTRACT_PENDING으로 전이된다.")
    @PostMapping("/api/v1/reservation-requests/{id}/contract")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<ContractResponse> create(
            @Parameter(description = "예약 요청 ID", example = "1") @PathVariable Long id) {
        return ApiResponse.ok(new ContractResponse(
                STUB_CONTRACT_ID,
                id,
                ContractTemplate.TITLE,
                ContractTemplate.CURRENT_VERSION,
                sampleClauses(),
                STUB_CONTENT_HASH,
                null,
                null,
                ContractStatus.PENDING));
    }

    @Operation(
            summary = "전자 서명",
            description =
                    "로그인 사용자가 해당 계약의 당사자인지 확인한 뒤 서명 시각을 기록한다. " + "양측이 모두 서명하면 계약은 SIGNED, 예약 요청은 CONTRACT_SIGNED가 된다.")
    @PostMapping("/api/v1/contracts/{id}/sign")
    public ApiResponse<ContractResponse> sign(@Parameter(description = "계약 ID", example = "1") @PathVariable Long id) {
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
                ContractTemplate.TITLE,
                ContractTemplate.CURRENT_VERSION,
                sampleClauses(),
                STUB_CONTENT_HASH,
                Instant.parse("2026-08-22T05:12:31Z"),
                Instant.parse("2026-08-22T06:40:02Z"),
                ContractStatus.SIGNED);
    }

    /**
     * ⚠️ 남은 스텁 응답용 샘플. <b>실제 문구의 원본은 {@code contract/template-v1.json}</b>이며,
     * 여기서는 그 템플릿을 고정 예시 값으로 바인딩해 형태만 보여준다. T5-3에서 이 메서드가 사라진다.
     */
    private List<ClauseDto> sampleClauses() {
        return ClauseBinder.bind(
                ContractTemplate.v1().clauses(),
                new ContractBinding(
                        "성수 연무장길 팝업 1층",
                        "서울 성동구 연무장길 45",
                        "김브랜드",
                        "박건물주",
                        LocalDate.of(2026, 9, 1),
                        LocalDate.of(2026, 9, 14),
                        14,
                        6_300_000L,
                        630_000L,
                        7_350_000L));
    }
}
