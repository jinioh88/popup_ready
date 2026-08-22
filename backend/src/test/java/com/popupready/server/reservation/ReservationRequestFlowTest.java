package com.popupready.server.reservation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.popupready.server.auth.JwtProvider;
import com.popupready.server.auth.UserRole;
import com.popupready.server.fixture.Fixture;
import com.popupready.server.fixture.FixtureCategory;
import com.popupready.server.fixture.FixtureRepository;
import com.popupready.server.space.Space;
import com.popupready.server.space.SpaceRepository;
import java.math.BigDecimal;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.Point;
import org.locationtech.jts.geom.PrecisionModel;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

/**
 * 토큰 → 공간·집기 조회 → 도면 재검증 → 견적 → 저장이 실제로 이어지는지 한 번에 확인한다.
 *
 * <p>조각별 테스트가 모두 통과해도 배선이 끊겨 있을 수 있다. 실제로 Phase 3에서 파라미터 검증이
 * 500으로 새던 결함은 단위 테스트가 아니라 실서버 호출에서 발견됐다. 웹이 빌더에서 처음 밟는
 * 경로가 여기이므로 이 테스트로 잠근다.
 *
 * <p>공간·집기는 시드에 기대지 않고 이 테스트가 직접 만든다 — 시드 값이 바뀌면 조용히 깨지고,
 * 그리드 규격이 판정 기준이라 남의 데이터에 얹으면 무엇을 검증하는지 흐려진다.
 * {@code @Transactional}로 만든 데이터는 롤백된다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class ReservationRequestFlowTest {

    private static final long BRAND_USER_ID = 4242L;

    private static final GeometryFactory GEOMETRY_FACTORY = new GeometryFactory(new PrecisionModel(), 4326);

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtProvider jwtProvider;

    @Autowired
    private SpaceRepository spaceRepository;

    @Autowired
    private FixtureRepository fixtureRepository;

    private Long spaceId;

    private Long fixtureId;

    @BeforeEach
    void createSpaceAndFixture() {
        // PostGIS 좌표는 (경도, 위도) 순이다.
        Point location = GEOMETRY_FACTORY.createPoint(new Coordinate(127.0557, 37.5445));
        Space space = spaceRepository.save(Space.create(
                "flowtest-성수 팝업 스페이스",
                "서울 성동구 성수이로 100",
                location,
                450_000L,
                new BigDecimal("0.10"),
                60.0,
                5_000,
                20,
                12,
                500,
                1L));
        // 3칸 × 1칸을 차지하고 일 렌털료가 30,000원인 행거. 14일이면 420,000원이다.
        Fixture fixture = fixtureRepository.save(
                Fixture.create("flowtest-스탠드 행거", FixtureCategory.HANGER, 1_200, 500, 0, 30_000L, 40, 1L));

        spaceId = space.getId();
        fixtureId = fixture.getId();
    }

    private String bearer() {
        return "Bearer " + jwtProvider.issue(BRAND_USER_ID, UserRole.BRAND);
    }

    private String body(String items) {
        return """
                {
                  "spaceId": %d,
                  "startDate": "2026-09-01",
                  "endDate": "2026-09-14",
                  "layout": { "gridCols": 20, "gridRows": 12, "cellSizeMm": 500, "items": [%s] }
                }
                """
                .formatted(spaceId, items);
    }

    private String item(int col, int row, int rotation) {
        return "{ \"fixtureId\": %d, \"col\": %d, \"row\": %d, \"rotation\": %d }"
                .formatted(fixtureId, col, row, rotation);
    }

    @Test
    @DisplayName("빌더가 보낸 도면 → 201과 §2.2 규약대로 계산된 견적을 돌려준다")
    void create_validLayout_returnsAgreedEstimate() throws Exception {
        mockMvc.perform(post("/api/v1/reservation-requests")
                        .header(HttpHeaders.AUTHORIZATION, bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body(item(0, 0, 0))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.estimate.days").value(14))
                .andExpect(jsonPath("$.data.estimate.spaceRentTotal").value(6_300_000L))
                .andExpect(jsonPath("$.data.estimate.fixtureRentalTotal").value(420_000L))
                .andExpect(jsonPath("$.data.estimate.deposit").value(630_000L))
                .andExpect(jsonPath("$.data.estimate.totalAmount").value(7_350_000L));
    }

    @Test
    @DisplayName("생성된 예약 → 토큰의 사용자를 브랜드로, 상태 DRAFT로 저장된다")
    void create_persistsDraftForTokenUser() throws Exception {
        String response = mockMvc.perform(post("/api/v1/reservation-requests")
                        .header(HttpHeaders.AUTHORIZATION, bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body(item(0, 0, 0))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.brandUserId").value(BRAND_USER_ID))
                .andExpect(jsonPath("$.data.status").value("DRAFT"))
                .andReturn()
                .getResponse()
                .getContentAsString();

        Long createdId = ((Number) JsonPath.read(response, "$.data.id")).longValue();
        assertThat(createdId).isNotNull();
    }

    @Test
    @DisplayName("겹치는 도면 → 400과 LAYOUT_OVERLAP")
    void create_overlappingLayout_isRejected() throws Exception {
        mockMvc.perform(post("/api/v1/reservation-requests")
                        .header(HttpHeaders.AUTHORIZATION, bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body(item(0, 0, 0) + ", " + item(2, 0, 0))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("LAYOUT_OVERLAP"));
    }

    @Test
    @DisplayName("회전 때문에 도면을 넘는 배치 → 400과 LAYOUT_OUT_OF_BOUNDS")
    void create_rotationOutOfBounds_isRejected() throws Exception {
        // 0도면 1칸 깊이라 들어가지만, 90도로 돌리면 3칸을 먹어 row 10·11·12가 되어 넘친다.
        mockMvc.perform(post("/api/v1/reservation-requests")
                        .header(HttpHeaders.AUTHORIZATION, bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body(item(0, 10, 90))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("LAYOUT_OUT_OF_BOUNDS"));
    }

    @Test
    @DisplayName("존재하지 않는 공간 → 404와 SPACE_NOT_FOUND")
    void create_unknownSpace_returnsNotFound() throws Exception {
        String unknownSpace =
                """
                {
                  "spaceId": 99999999,
                  "startDate": "2026-09-01",
                  "endDate": "2026-09-14",
                  "layout": { "gridCols": 20, "gridRows": 12, "cellSizeMm": 500, "items": [] }
                }
                """;

        mockMvc.perform(post("/api/v1/reservation-requests")
                        .header(HttpHeaders.AUTHORIZATION, bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(unknownSpace))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error.code").value("SPACE_NOT_FOUND"));
    }

    @Test
    @DisplayName("종료일이 시작일보다 이름 → 400과 VALIDATION_FAILED")
    void create_endBeforeStart_isRejected() throws Exception {
        String reversed =
                """
                {
                  "spaceId": %d,
                  "startDate": "2026-09-14",
                  "endDate": "2026-09-01",
                  "layout": { "gridCols": 20, "gridRows": 12, "cellSizeMm": 500, "items": [] }
                }
                """
                        .formatted(spaceId);

        mockMvc.perform(post("/api/v1/reservation-requests")
                        .header(HttpHeaders.AUTHORIZATION, bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(reversed))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_FAILED"));
    }

    @Test
    @DisplayName("공간 도면과 다른 그리드 → 400과 VALIDATION_FAILED")
    void create_gridMismatch_isRejected() throws Exception {
        String wrongGrid =
                """
                {
                  "spaceId": %d,
                  "startDate": "2026-09-01",
                  "endDate": "2026-09-14",
                  "layout": { "gridCols": 40, "gridRows": 24, "cellSizeMm": 500, "items": [] }
                }
                """
                        .formatted(spaceId);

        mockMvc.perform(post("/api/v1/reservation-requests")
                        .header(HttpHeaders.AUTHORIZATION, bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(wrongGrid))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_FAILED"));
    }
}
