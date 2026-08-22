package com.popupready.server.fixture;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 대여 가능한 모듈러 집기(스프린트 문서 §2.1).
 *
 * <p>{@code vendorId}는 공급사 User의 식별자를 스칼라로만 들고 있다 — 이유는 {@code Space.ownerId}와 같다.
 *
 * <p>{@code widthMm}·{@code depthMm}는 점유 셀 계산의 입력이고(§2.3), {@code stockQty}는 재고 상한이다.
 * 날짜별 가용 재고는 Sprint 2 범위이고 여기 값은 총 보유량이다.
 */
@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Fixture {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private FixtureCategory category;

    @Column(nullable = false)
    private int widthMm;

    @Column(nullable = false)
    private int depthMm;

    /** 비전기 집기는 0이다. Sprint 2의 전력 합산 가드가 이 값을 더한다. */
    @Column(nullable = false)
    private int powerWatt;

    @Column(nullable = false)
    private long dailyRentalFee;

    @Column(nullable = false)
    private int stockQty;

    @Column(nullable = false)
    private Long vendorId;

    private Fixture(
            String name,
            FixtureCategory category,
            int widthMm,
            int depthMm,
            int powerWatt,
            long dailyRentalFee,
            int stockQty,
            Long vendorId) {
        this.name = name;
        this.category = category;
        this.widthMm = widthMm;
        this.depthMm = depthMm;
        this.powerWatt = powerWatt;
        this.dailyRentalFee = dailyRentalFee;
        this.stockQty = stockQty;
        this.vendorId = vendorId;
    }

    public static Fixture create(
            String name,
            FixtureCategory category,
            int widthMm,
            int depthMm,
            int powerWatt,
            long dailyRentalFee,
            int stockQty,
            Long vendorId) {
        return new Fixture(name, category, widthMm, depthMm, powerWatt, dailyRentalFee, stockQty, vendorId);
    }
}
