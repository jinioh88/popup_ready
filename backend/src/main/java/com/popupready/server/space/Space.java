package com.popupready.server.space;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import java.math.BigDecimal;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.locationtech.jts.geom.Point;

/**
 * 팝업 운영이 가능한 상가 공간(스프린트 문서 §2.1).
 *
 * <p><b>{@code ownerId}는 건물주 User의 식별자를 스칼라로만 들고 있다.</b> 연관관계로 묶으면
 * {@code space}가 {@code auth}의 엔티티를 직접 참조하게 되어 패키지 경계 규칙(backend/CLAUDE.md)을
 * 깬다. 사용자 정보가 필요하면 {@code auth}의 서비스를 통해 조회한다.
 *
 * <p>{@code location}은 PostGIS {@code geometry(Point,4326)}다. GIST 인덱스는 {@code ddl-auto}가
 * 만들지 않으므로 Flyway 베이스라인 시점에 반드시 포함해야 한다.
 */
@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Space {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String address;

    @Column(columnDefinition = "geometry(Point,4326)", nullable = false)
    private Point location;

    /** 원/일. 금액은 원 단위 정수다. */
    @Column(nullable = false)
    private long dailyRent;

    /** 보증금 비율. 견적에 곱해지므로 부동소수가 아닌 십진수로 다룬다. */
    @Column(nullable = false, precision = 4, scale = 3)
    private BigDecimal depositRate;

    @Column(nullable = false)
    private double floorAreaM2;

    @Column(nullable = false)
    private int maxPowerWatt;

    @Column(nullable = false)
    private int gridCols;

    @Column(nullable = false)
    private int gridRows;

    /** 그리드 한 칸의 실제 크기(mm). 점유 셀 계산의 분모다(§2.3). */
    @Column(nullable = false)
    private int cellSizeMm;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private SpaceStatus status;

    @Column(nullable = false)
    private Long ownerId;

    private Space(
            String name,
            String address,
            Point location,
            long dailyRent,
            BigDecimal depositRate,
            double floorAreaM2,
            int maxPowerWatt,
            int gridCols,
            int gridRows,
            int cellSizeMm,
            Long ownerId) {
        this.name = name;
        this.address = address;
        this.location = location;
        this.dailyRent = dailyRent;
        this.depositRate = depositRate;
        this.floorAreaM2 = floorAreaM2;
        this.maxPowerWatt = maxPowerWatt;
        this.gridCols = gridCols;
        this.gridRows = gridRows;
        this.cellSizeMm = cellSizeMm;
        this.ownerId = ownerId;
        this.status = SpaceStatus.ACTIVE;
    }

    public static Space create(
            String name,
            String address,
            Point location,
            long dailyRent,
            BigDecimal depositRate,
            double floorAreaM2,
            int maxPowerWatt,
            int gridCols,
            int gridRows,
            int cellSizeMm,
            Long ownerId) {
        return new Space(
                name,
                address,
                location,
                dailyRent,
                depositRate,
                floorAreaM2,
                maxPowerWatt,
                gridCols,
                gridRows,
                cellSizeMm,
                ownerId);
    }

    public void deactivate() {
        this.status = SpaceStatus.INACTIVE;
    }
}
