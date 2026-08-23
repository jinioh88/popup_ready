package com.popupready.server.reservation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.popupready.server.common.ApiException;
import com.popupready.server.common.ErrorCode;
import com.popupready.server.fixture.FixtureCategory;
import com.popupready.server.fixture.FixtureResponse;
import com.popupready.server.fixture.FixtureService;
import com.popupready.server.space.LocationDto;
import com.popupready.server.space.SpaceDetailResponse;
import com.popupready.server.space.SpaceService;
import com.popupready.server.space.SpaceStatus;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/**
 * 예약 요청 생성 유스케이스. 판정식 자체는 순수 클래스(LayoutValidator·EstimateCalculator)가
 * 단위 테스트로 잠그고 있으므로, 여기서는 <b>흐름</b>을 본다 — 무엇을 어떤 순서로 확인하고,
 * 거절될 때 저장이 일어나지 않는가.
 */
@ExtendWith(MockitoExtension.class)
class ReservationRequestServiceTest {

    private static final long BRAND_USER_ID = 7L;

    private static final LocalDate START = LocalDate.of(2026, 9, 1);

    private static final LocalDate END = LocalDate.of(2026, 9, 14);

    @Mock
    private SpaceService spaceService;

    @Mock
    private FixtureService fixtureService;

    @Mock
    private ReservationRequestRepository reservationRequestRepository;

    @InjectMocks
    private ReservationRequestService reservationRequestService;

    private static SpaceDetailResponse space(SpaceStatus status) {
        return new SpaceDetailResponse(
                1L,
                "성수 팝업 스페이스",
                "서울 성동구 성수이로 100",
                new LocationDto(37.5445, 127.0557),
                450_000L,
                new BigDecimal("0.10"),
                60.0,
                5_000,
                20,
                12,
                500,
                status);
    }

    /** 일 렌털료 30,000원짜리 행거. 14일이면 420,000원이다. */
    private static FixtureResponse hanger() {
        return new FixtureResponse(3L, "스탠드 행거 1200", FixtureCategory.HANGER, 1_200, 500, 0, 30_000L, 40);
    }

    private static CreateReservationRequest request(LayoutDto layout) {
        return new CreateReservationRequest(1L, START, END, layout);
    }

    private static LayoutDto layout(LayoutItemDto... items) {
        return new LayoutDto(20, 12, 500, List.of(items));
    }

    private void givenActiveSpaceWithHanger() {
        given(spaceService.detail(1L)).willReturn(space(SpaceStatus.ACTIVE));
        given(fixtureService.findAllByIds(anyCollection())).willReturn(List.of(hanger()));
    }

    private void givenSavedRequestGetsId() {
        given(reservationRequestRepository.save(any(ReservationRequest.class)))
                .willAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    @DisplayName("정상 요청 → 규약대로 계산된 견적을 담아 돌려준다")
    void create_validRequest_returnsAgreedEstimate() {
        givenActiveSpaceWithHanger();
        givenSavedRequestGetsId();

        ReservationRequestResponse response =
                reservationRequestService.create(BRAND_USER_ID, request(layout(new LayoutItemDto(3L, 0, 0, 0))));

        assertThat(response.estimate()).isEqualTo(new EstimateResponse(14, 6_300_000L, 420_000L, 630_000L, 7_350_000L));
    }

    @Test
    @DisplayName("정상 요청 → DRAFT 상태로, 토큰의 사용자를 브랜드로 삼아 저장한다")
    void create_validRequest_savesAsDraftForTokenUser() {
        givenActiveSpaceWithHanger();
        givenSavedRequestGetsId();

        ReservationRequestResponse response =
                reservationRequestService.create(BRAND_USER_ID, request(layout(new LayoutItemDto(3L, 0, 0, 0))));

        assertThat(response.brandUserId()).isEqualTo(BRAND_USER_ID);
        assertThat(response.status()).isEqualTo(ReservationStatus.DRAFT);
    }

    @Test
    @DisplayName("집기가 없는 레이아웃 → 집기 조회를 하지 않고 통과한다")
    void create_emptyLayout_skipsFixtureLookup() {
        given(spaceService.detail(1L)).willReturn(space(SpaceStatus.ACTIVE));
        givenSavedRequestGetsId();

        reservationRequestService.create(BRAND_USER_ID, request(layout()));

        verify(fixtureService, never()).findAllByIds(anyCollection());
    }

    @Test
    @DisplayName("종료일이 시작일보다 이름 → 400으로 거부하고 공간 조회조차 하지 않는다")
    void create_endBeforeStart_isRejectedBeforeLookup() {
        CreateReservationRequest reversed = new CreateReservationRequest(1L, END, START, layout());

        assertThatThrownBy(() -> reservationRequestService.create(BRAND_USER_ID, reversed))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getErrorCode())
                .isEqualTo(ErrorCode.VALIDATION_FAILED);
        verify(spaceService, never()).detail(any());
    }

    @Test
    @DisplayName("비활성 공간에 예약 요청 → 400으로 거부한다")
    void create_inactiveSpace_isRejected() {
        given(spaceService.detail(1L)).willReturn(space(SpaceStatus.INACTIVE));

        assertThatThrownBy(() -> reservationRequestService.create(BRAND_USER_ID, request(layout())))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getErrorCode())
                .isEqualTo(ErrorCode.VALIDATION_FAILED);
    }

    @Test
    @DisplayName("레이아웃이 겹침 → 거부하고 예약을 저장하지 않는다")
    void create_invalidLayout_savesNothing() {
        givenActiveSpaceWithHanger();

        CreateReservationRequest overlapping =
                request(layout(new LayoutItemDto(3L, 0, 0, 0), new LayoutItemDto(3L, 2, 0, 0)));

        assertThatThrownBy(() -> reservationRequestService.create(BRAND_USER_ID, overlapping))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getErrorCode())
                .isEqualTo(ErrorCode.LAYOUT_OVERLAP);
        verify(reservationRequestRepository, never()).save(any());
    }

    @Test
    @DisplayName("존재하지 않는 집기를 배치 → 집기를 찾을 수 없다고 거부한다")
    void create_unknownFixture_isRejected() {
        given(spaceService.detail(1L)).willReturn(space(SpaceStatus.ACTIVE));
        given(fixtureService.findAllByIds(anyCollection())).willReturn(List.of());

        assertThatThrownBy(() -> reservationRequestService.create(
                        BRAND_USER_ID, request(layout(new LayoutItemDto(3L, 0, 0, 0)))))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getErrorCode())
                .isEqualTo(ErrorCode.FIXTURE_NOT_FOUND);
    }

    @Test
    @DisplayName("레이아웃 그리드가 공간 도면과 다름 → 400으로 거부한다")
    void create_gridMismatch_isRejected() {
        given(spaceService.detail(1L)).willReturn(space(SpaceStatus.ACTIVE));

        CreateReservationRequest wrongGrid = request(new LayoutDto(40, 24, 500, List.of()));

        assertThatThrownBy(() -> reservationRequestService.create(BRAND_USER_ID, wrongGrid))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getErrorCode())
                .isEqualTo(ErrorCode.VALIDATION_FAILED);
    }

    @Test
    @DisplayName("저장한 예약의 견적 합계 → 응답의 totalAmount와 같다")
    void create_persistsTotalEstimateMatchingResponse() {
        givenActiveSpaceWithHanger();
        givenSavedRequestGetsId();

        ReservationRequestResponse response =
                reservationRequestService.create(BRAND_USER_ID, request(layout(new LayoutItemDto(3L, 0, 0, 0))));

        org.mockito.ArgumentCaptor<ReservationRequest> captor =
                org.mockito.ArgumentCaptor.forClass(ReservationRequest.class);
        verify(reservationRequestRepository).save(captor.capture());
        assertThat(captor.getValue().getTotalEstimate())
                .isEqualTo(response.estimate().totalAmount());
    }

    // ── 단건 조회 인가 (Sprint 2 T0-3) ────────────────────────────────────────
    // 역할로는 가를 수 없는 인가다 — 브랜드도 건물주도 같은 예약을 본다.
    // Security 설정이 막을 수 없으므로 서비스가 판정하고, 그 판정을 여기서 잠근다.

    private static final long LANDLORD_USER_ID = 9L;

    private ReservationRequest storedReservation() {
        ReservationRequest stored = ReservationRequest.create(
                1L,
                BRAND_USER_ID,
                START,
                END,
                layout(),
                new EstimateResponse(14, 6_300_000L, 0L, 630_000L, 6_930_000L));
        given(reservationRequestRepository.findById(1L)).willReturn(java.util.Optional.of(stored));
        return stored;
    }

    @Test
    @DisplayName("예약을 만든 브랜드 본인이 조회 → 견적 스냅샷과 함께 반환")
    void detail_byBrandOwner_returnsSnapshot() {
        storedReservation();

        ReservationRequestResponse response = reservationRequestService.detail(BRAND_USER_ID, 1L);

        assertThat(response.estimate().totalAmount()).isEqualTo(6_930_000L);
    }

    @Test
    @DisplayName("그 공간의 건물주가 조회 → 허용")
    void detail_byLandlord_isAllowed() {
        storedReservation();
        given(spaceService.ownerIdOf(1L)).willReturn(LANDLORD_USER_ID);

        // id는 저장 전 엔티티라 null이다 — 여기서 볼 것은 "거절되지 않았다"는 사실이다.
        assertThat(reservationRequestService.detail(LANDLORD_USER_ID, 1L).brandUserId())
                .isEqualTo(BRAND_USER_ID);
    }

    @Test
    @DisplayName("당사자가 아닌 사용자가 조회 → FORBIDDEN")
    void detail_byStranger_isRejected() {
        storedReservation();
        given(spaceService.ownerIdOf(1L)).willReturn(LANDLORD_USER_ID);

        assertThatThrownBy(() -> reservationRequestService.detail(999L, 1L))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getErrorCode())
                .isEqualTo(ErrorCode.FORBIDDEN);
    }

    @Test
    @DisplayName("없는 예약 조회 → 당사자 판정 전에 404")
    void detail_missingReservation_returnsNotFound() {
        given(reservationRequestRepository.findById(404L)).willReturn(java.util.Optional.empty());

        assertThatThrownBy(() -> reservationRequestService.detail(BRAND_USER_ID, 404L))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getErrorCode())
                .isEqualTo(ErrorCode.RESERVATION_REQUEST_NOT_FOUND);
    }

    // ── 내 예약 목록 (2026-08-23 계약 추가) ──────────────────────────────────

    @Test
    @DisplayName("status 없이 목록 조회 → 내 예약 전체를 최근 순으로")
    void listMine_withoutStatus_returnsAll() {
        given(reservationRequestRepository.findByBrandUserIdOrderByIdDesc(BRAND_USER_ID))
                .willReturn(List.of(ReservationRequest.create(
                        1L,
                        BRAND_USER_ID,
                        START,
                        END,
                        layout(),
                        new EstimateResponse(14, 6_300_000L, 0L, 630_000L, 6_930_000L))));

        assertThat(reservationRequestService.listMine(BRAND_USER_ID, null)).hasSize(1);
    }

    @Test
    @DisplayName("status를 주면 → 그 상태만 거르는 조회로 간다")
    void listMine_withStatus_filtersByStatus() {
        // 전체 조회 후 메모리에서 거르지 않는다 — 예약이 늘면 그대로 비용이 된다.
        given(reservationRequestRepository.findByBrandUserIdAndStatusOrderByIdDesc(
                        BRAND_USER_ID, ReservationStatus.CONTRACT_SIGNED))
                .willReturn(List.of());

        assertThat(reservationRequestService.listMine(BRAND_USER_ID, ReservationStatus.CONTRACT_SIGNED))
                .isEmpty();
        verify(reservationRequestRepository, never()).findByBrandUserIdOrderByIdDesc(BRAND_USER_ID);
    }

    @Test
    @DisplayName("남의 예약은 목록에 섞이지 않는다 → 조회 자체가 내 ID로 걸린다")
    void listMine_queriesByCallerId() {
        given(reservationRequestRepository.findByBrandUserIdOrderByIdDesc(999L)).willReturn(List.of());

        reservationRequestService.listMine(999L, null);

        // 목록은 '내 것'만 돌려주므로 당사자 판정이 따로 필요 없다 — 조회 조건이 곧 인가다.
        verify(reservationRequestRepository).findByBrandUserIdOrderByIdDesc(999L);
        verify(reservationRequestRepository, never()).findByBrandUserIdOrderByIdDesc(BRAND_USER_ID);
    }
}
