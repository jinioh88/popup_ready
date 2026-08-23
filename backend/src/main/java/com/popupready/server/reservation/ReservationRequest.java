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

    // 견적 내역을 통째로 보존한다. 합계만 남기면 계약 바인딩·조회 시 다시 계산해야 하는데,
    // 그 사이 공간 단가나 집기 렌털료가 바뀌었으면 계약서 금액과 예약 금액이 갈라진다.
    // 견적은 "그때 그 값"이어야 하므로 파생값이 아니라 사실로 저장한다.
    //
    // ⚠️ ddl-auto=update가 기존 행이 있는 테이블에 NOT NULL 컬럼을 그냥 붙이지 못해 default 0을
    //    함께 준다. Flyway 베이스라인에서는 이 default를 빼고 NOT NULL만 남긴다.
    private static final String MONEY_COLUMN = "bigint default 0";

    @Column(nullable = false, columnDefinition = MONEY_COLUMN)
    private long spaceRentTotal;

    @Column(nullable = false, columnDefinition = MONEY_COLUMN)
    private long fixtureRentalTotal;

    /** 보증금(원). 일시사용 요건상 하향 설계되며 기준은 공간 대여료뿐이다(§2.2). */
    @Column(nullable = false, columnDefinition = MONEY_COLUMN)
    private long deposit;

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
            EstimateResponse estimate) {
        this.spaceId = spaceId;
        this.brandUserId = brandUserId;
        this.startDate = startDate;
        this.endDate = endDate;
        this.layout = layout;
        this.spaceRentTotal = estimate.spaceRentTotal();
        this.fixtureRentalTotal = estimate.fixtureRentalTotal();
        this.deposit = estimate.deposit();
        this.totalEstimate = estimate.totalAmount();
        this.status = ReservationStatus.DRAFT;
    }

    public static ReservationRequest create(
            Long spaceId,
            Long brandUserId,
            LocalDate startDate,
            LocalDate endDate,
            LayoutDto layout,
            EstimateResponse estimate) {
        return new ReservationRequest(spaceId, brandUserId, startDate, endDate, layout, estimate);
    }

    /** 저장된 그대로의 견적. 일수만 날짜에서 다시 세며, 금액은 어느 것도 재계산하지 않는다. */
    public EstimateResponse getEstimate() {
        return new EstimateResponse(getPeriod().days(), spaceRentTotal, fixtureRentalTotal, deposit, totalEstimate);
    }

    /** 사용 기간. 저장된 값이므로 이미 유효하다. */
    public ReservationPeriod getPeriod() {
        return ReservationPeriod.of(startDate, endDate);
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

    /**
     * 결제 준비가 끝났다(주문 발급). <b>아직 자리를 잡은 것이 아니다</b> — 가용량·겹침 판정은
     * {@code PAID}만 센다.
     */
    public void markPaymentPending() {
        requireStatus(ReservationStatus.CONTRACT_SIGNED, ReservationStatus.PAYMENT_PENDING);
        this.status = ReservationStatus.PAYMENT_PENDING;
    }

    /**
     * 결제가 승인됐다. 이 시점부터 공간·집기를 실제로 점유한다.
     *
     * <p>결제 준비를 건너뛴 전이는 허용하지 않는다 — orderId 없이 자리를 잡은 예약은 분쟁 시
     * 대조할 것이 없다. 이미 {@code PAID}인 것을 다시 전이시키는 것도 막는다: "예약당 PAID는
     * 최대 1건"이라는 실질 제약의 마지막 방어선이다.
     */
    public void markPaid() {
        requireStatus(ReservationStatus.PAYMENT_PENDING, ReservationStatus.PAID);
        this.status = ReservationStatus.PAID;
    }

    private void requireStatus(ReservationStatus expected, ReservationStatus target) {
        if (this.status != expected) {
            throw new IllegalStateException(
                    "%s → %s 전이는 허용되지 않는다 (%s 상태에서만 가능)".formatted(this.status, target, expected));
        }
    }
}
