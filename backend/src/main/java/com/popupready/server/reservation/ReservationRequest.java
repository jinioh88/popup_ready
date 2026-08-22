package com.popupready.server.reservation;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import java.time.LocalDate;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * 브랜드가 만든 예약 요청(스프린트 문서 §2.1). Sprint 2에서 결제 상태와 분산 락이 이 위에 얹힌다.
 *
 * <p>{@code spaceId}·{@code brandUserId}는 타 도메인 식별자를 스칼라로만 들고 있다 — 연관관계로 묶으면
 * 패키지 경계 규칙이 깨진다.
 *
 * <p><b>레이아웃은 JSONB로 저장하며 API 계약의 {@link LayoutDto}를 그대로 쓴다.</b> §2.3 스키마가
 * 계약이자 저장 형식이라 값 객체를 따로 두면 같은 구조가 둘로 갈라진다. 대신 이 DTO를 바꾸는 것은
 * 저장된 데이터의 해석을 바꾸는 일이므로 API 변경과 동일한 절차(3종 세트)를 밟아야 한다.
 *
 * <p>상태 전이는 setter가 아니라 도메인 메서드로만 이루어지며, 잘못된 전이는 예외로 막는다.
 */
@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ReservationRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long spaceId;

    @Column(nullable = false)
    private Long brandUserId;

    @Column(nullable = false)
    private LocalDate startDate;

    @Column(nullable = false)
    private LocalDate endDate;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private LayoutDto layout;

    /** 견적 합계(원). 산출 근거는 §2.2 "견적 계산 규약"이며 보증금까지 포함한 금액이다. */
    @Column(nullable = false)
    private long totalEstimate;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ReservationStatus status;

    private ReservationRequest(
            Long spaceId,
            Long brandUserId,
            LocalDate startDate,
            LocalDate endDate,
            LayoutDto layout,
            long totalEstimate) {
        this.spaceId = spaceId;
        this.brandUserId = brandUserId;
        this.startDate = startDate;
        this.endDate = endDate;
        this.layout = layout;
        this.totalEstimate = totalEstimate;
        this.status = ReservationStatus.DRAFT;
    }

    public static ReservationRequest create(
            Long spaceId,
            Long brandUserId,
            LocalDate startDate,
            LocalDate endDate,
            LayoutDto layout,
            long totalEstimate) {
        return new ReservationRequest(spaceId, brandUserId, startDate, endDate, layout, totalEstimate);
    }

    /** 계약서가 만들어졌다. DRAFT에서만 가능하다. */
    public void markContractPending() {
        requireStatus(ReservationStatus.DRAFT, ReservationStatus.CONTRACT_PENDING);
        this.status = ReservationStatus.CONTRACT_PENDING;
    }

    /** 양 당사자 서명이 끝났다. 계약서 생성을 건너뛴 전이는 허용하지 않는다. */
    public void markContractSigned() {
        requireStatus(ReservationStatus.CONTRACT_PENDING, ReservationStatus.CONTRACT_SIGNED);
        this.status = ReservationStatus.CONTRACT_SIGNED;
    }

    private void requireStatus(ReservationStatus expected, ReservationStatus target) {
        if (this.status != expected) {
            throw new IllegalStateException(
                    "%s → %s 전이는 허용되지 않는다 (%s 상태에서만 가능)".formatted(this.status, target, expected));
        }
    }
}
