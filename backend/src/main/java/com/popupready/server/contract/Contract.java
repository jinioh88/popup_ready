package com.popupready.server.contract;

import com.popupready.server.common.ApiException;
import com.popupready.server.common.ErrorCode;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import java.time.Instant;
import java.util.List;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * 일시사용 표준 계약(US-202).
 *
 * <p><b>조항은 생성 시점의 전문 스냅샷이다.</b> 템플릿이 나중에 바뀌어도 이미 만들어진 계약의 문구는
 * 변하지 않는다 — 분쟁 시 소명 자료가 되려면 "그때 그 문서"여야 한다. 같은 이유로 당사자 ID도
 * 스냅샷으로 들고 있다. 공간의 소유자가 나중에 바뀌어도 서명할 사람은 계약 당시의 건물주다.
 *
 * <p>서명은 외부 전자서명 연동 없이 <b>로그인 세션 기반 클릭 서명 + 타임스탬프</b>로 갈음한다
 * (스코프 결정, 변경 시 PM 협의). 그래서 "누가 서명할 수 있는가"를 이 엔티티가 직접 지키는 것이
 * 사실상 유일한 방어선이다 — 서비스가 깜빡해도 여기서 막힌다.
 *
 * <p>{@code reservationRequestId}·당사자 ID는 타 도메인 식별자를 스칼라로만 들고 있다.
 * 연관관계로 묶으면 패키지 경계 규칙이 깨진다.
 */
@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Contract {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 예약 하나에 계약은 하나다. 중복 생성은 서비스가 409로 막고, 여기서 유일성을 함께 건다. */
    @Column(nullable = false, unique = true)
    private Long reservationRequestId;

    @Column(nullable = false)
    private Long brandUserId;

    @Column(nullable = false)
    private Long landlordUserId;

    @Column(nullable = false)
    private String templateVersion;

    /** 생성 시점의 조항 전문. JSONB로 저장한다 — 레이아웃과 같은 방식이다. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private List<ClauseDto> clauses;

    /** 조항 전문 + 발행 시각의 SHA-256. 위·변조를 감지하기 위한 것이다. */
    @Column(nullable = false, length = 64)
    private String contentHash;

    /** 해시에 묶인 발행 시각. 이 값이 없으면 해시를 다시 계산할 수 없다. */
    @Column(nullable = false)
    private Instant issuedAt;

    private Instant brandSignedAt;

    private Instant landlordSignedAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ContractStatus status;

    private Contract(
            Long reservationRequestId,
            Long brandUserId,
            Long landlordUserId,
            String templateVersion,
            List<ClauseDto> clauses,
            Instant issuedAt) {
        this.reservationRequestId = reservationRequestId;
        this.brandUserId = brandUserId;
        this.landlordUserId = landlordUserId;
        this.templateVersion = templateVersion;
        this.clauses = List.copyOf(clauses);
        this.issuedAt = issuedAt;
        this.contentHash = ContractHasher.hash(templateVersion, reservationRequestId, this.clauses, issuedAt);
        this.status = ContractStatus.PENDING;
    }

    public static Contract create(
            Long reservationRequestId,
            Long brandUserId,
            Long landlordUserId,
            String templateVersion,
            List<ClauseDto> clauses,
            Instant issuedAt) {
        return new Contract(reservationRequestId, brandUserId, landlordUserId, templateVersion, clauses, issuedAt);
    }

    /**
     * 클릭 서명. 당사자인지, 이미 서명했는지를 여기서 판정한다.
     *
     * <p>브랜드와 건물주가 같은 계정이면 한 번의 서명으로 양측이 채워진다 — 개발 시드에서 실제로
     * 생기는 상황이고, 조용히 절반만 서명된 채 멈추면 영영 SIGNED가 되지 않는다.
     */
    public void sign(long userId, Instant signedAt) {
        boolean isBrand = brandUserId == userId;
        boolean isLandlord = landlordUserId == userId;
        if (!isBrand && !isLandlord) {
            throw new ApiException(ErrorCode.NOT_CONTRACT_PARTY, "이 계약의 당사자가 아닙니다");
        }
        if ((isBrand && brandSignedAt != null) || (isLandlord && landlordSignedAt != null)) {
            throw new ApiException(ErrorCode.CONTRACT_ALREADY_SIGNED, "이미 서명했습니다");
        }
        if (isBrand) {
            brandSignedAt = signedAt;
        }
        if (isLandlord) {
            landlordSignedAt = signedAt;
        }
        if (brandSignedAt != null && landlordSignedAt != null) {
            status = ContractStatus.SIGNED;
        }
    }

    /** 양측 서명이 끝났는가. 예약 요청 상태를 함께 옮길지 판단하는 데 쓴다. */
    public boolean isFullySigned() {
        return status == ContractStatus.SIGNED;
    }

    /**
     * 저장된 해시를 다시 계산해 스냅샷이 그대로인지 본다.
     *
     * <p>DB를 직접 쓸 수 있는 사람은 해시까지 고쳐 넣을 수 있으므로 이것은 서명이 아니라 체크섬이다.
     * 부분 변조·마이그레이션 사고를 잡는 용도다.
     */
    public boolean hasIntactContent() {
        return contentHash.equals(ContractHasher.hash(templateVersion, reservationRequestId, clauses, issuedAt));
    }
}
