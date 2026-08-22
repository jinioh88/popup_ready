package com.popupready.server.space;

import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;

/**
 * 상가 상세. 요약 필드 전체에 빌더가 캔버스를 그리는 데 필요한 grid 정보와,
 * 견적 계산에 쓰이는 보증금 비율이 더해진다.
 *
 * <p>금액은 원 단위 정수(long), 비율은 부동소수 오차가 견적에 번지지 않도록 BigDecimal이다.
 */
@Schema(description = "공간 상세(빌더 진입용)")
public record SpaceDetailResponse(
        @Schema(description = "공간 ID", example = "1") Long id,
        @Schema(description = "공간 이름", example = "성수 연무장길 팝업 1층") String name,
        @Schema(description = "주소", example = "서울 성동구 연무장길 45") String address,
        @Schema(description = "위치 좌표") LocationDto location,
        @Schema(description = "일일 대여료(원)", example = "450000") long dailyRent,
        @Schema(description = "보증금 비율. 일시사용 요건상 하향 설계된다", example = "0.10") BigDecimal depositRate,
        @Schema(description = "실면적(㎡)", example = "82.5") double floorAreaM2,
        @Schema(description = "허용 전력(W). 배치한 집기 소비전력 합이 이 값을 넘으면 결제가 차단된다", example = "5000")
                int maxPowerWatt,
        @Schema(description = "도면 그리드 가로 칸 수", example = "20") int gridCols,
        @Schema(description = "도면 그리드 세로 칸 수", example = "12") int gridRows,
        @Schema(description = "그리드 한 칸의 실제 크기(mm)", example = "500") int cellSizeMm,
        @Schema(description = "공간 상태") SpaceStatus status) {}
