package com.popupready.server.contract;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.popupready.server.auth.JwtProvider;
import com.popupready.server.auth.UserRole;
import com.popupready.server.auth.UserService;
import com.popupready.server.reservation.ReservationRequestRepository;
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
 * 스프린트 데모 시나리오의 계약 구간을 한 번에 밟는다(US-202): 예약 요청 → 계약 생성 →
 * 브랜드 서명 → 건물주 서명 → SIGNED.
 *
 * <p>조각별 테스트가 다 통과해도 배선이 끊겨 있을 수 있다. 특히 이 경로는 <b>세 도메인
 * (reservation·space·auth)을 가로지르고</b> 예약 상태 전이까지 함께 움직여서, 어느 한 곳만
 * 어긋나도 데모 당일에야 드러난다.
 *
 * <p>당사자 계정과 공간을 직접 만든다 — 시드에 기대면 시드 값이 바뀔 때 조용히 깨진다.
 * {@code @Transactional}로 전부 롤백된다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class ContractFlowTest {

    private static final GeometryFactory GEOMETRY_FACTORY = new GeometryFactory(new PrecisionModel(), 4326);

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtProvider jwtProvider;

    @Autowired
    private SpaceRepository spaceRepository;

    @Autowired
    private UserService userService;

    @Autowired
    private ReservationRequestRepository reservationRequestRepository;

    private long brandUserId;
    private long landlordUserId;
    private long reservationId;

    @BeforeEach
    void setUpDemoData() throws Exception {
        brandUserId = signup("flowtest-brand@popupready.com", "김브랜드", UserRole.BRAND);
        landlordUserId = signup("flowtest-landlord@popupready.com", "박건물주", UserRole.LANDLORD);

        Point location = GEOMETRY_FACTORY.createPoint(new Coordinate(127.0557, 37.5445));
        Space space = spaceRepository.save(Space.create(
                "flowtest-성수 계약 스페이스",
                "서울 성동구 연무장길 45",
                location,
                450_000L,
                new BigDecimal("0.10"),
                60.0,
                5_000,
                20,
                12,
                500,
                landlordUserId));

        reservationId = createReservation(space.getId());
    }

    private long signup(String email, String name, UserRole role) throws Exception {
        String body =
                """
                {"email":"%s","password":"password123","name":"%s","role":"%s"}
                """
                        .formatted(email, name, role);
        mockMvc.perform(post("/api/v1/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated());
        return userService.findIdByEmail(email).orElseThrow();
    }

    private long createReservation(Long spaceId) throws Exception {
        String body =
                """
                {
                  "spaceId": %d,
                  "startDate": "2026-09-01",
                  "endDate": "2026-09-14",
                  "layout": { "gridCols": 20, "gridRows": 12, "cellSizeMm": 500, "items": [] }
                }
                """
                        .formatted(spaceId);
        String response = mockMvc.perform(post("/api/v1/reservation-requests")
                        .header(HttpHeaders.AUTHORIZATION, bearer(brandUserId, UserRole.BRAND))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        return ((Number) JsonPath.read(response, "$.data.id")).longValue();
    }

    private String bearer(long userId, UserRole role) {
        return "Bearer " + jwtProvider.issue(userId, role);
    }

    private String createContract() throws Exception {
        return mockMvc.perform(post("/api/v1/reservation-requests/%d/contract".formatted(reservationId))
                        .header(HttpHeaders.AUTHORIZATION, bearer(brandUserId, UserRole.BRAND)))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
    }

    private long contractId() throws Exception {
        return ((Number) JsonPath.read(createContract(), "$.data.id")).longValue();
    }

    private void sign(long contractId, long userId, UserRole role) throws Exception {
        mockMvc.perform(post("/api/v1/contracts/%d/sign".formatted(contractId))
                        .header(HttpHeaders.AUTHORIZATION, bearer(userId, role)))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("계약 생성 → 명칭 고정·PENDING·조항 7종이 예약 데이터로 채워져 나온다")
    void create_bindsReservationDataIntoClauses() throws Exception {
        String response = createContract();

        assertThat((String) JsonPath.read(response, "$.data.title")).isEqualTo("단기 공간사용 제휴계약");
        assertThat((String) JsonPath.read(response, "$.data.status")).isEqualTo("PENDING");
        assertThat((java.util.List<?>) JsonPath.read(response, "$.data.clauses"))
                .hasSize(7);
        // 실제 공간·기간·금액이 전문에 박혀야 한다. 미치환 변수가 남으면 소명 자료로서 결함이다.
        assertThat(response)
                .contains("flowtest-성수 계약 스페이스")
                .contains("2026-09-01")
                .contains("14일간")
                .contains("6,300,000")
                .doesNotContain("{{");
    }

    @Test
    @DisplayName("계약 생성 → 예약 요청이 CONTRACT_PENDING으로 전이한다")
    void create_movesReservationToContractPending() throws Exception {
        createContract();

        assertThat(reservationRequestRepository.findById(reservationId))
                .get()
                .extracting(r -> r.getStatus().name())
                .isEqualTo("CONTRACT_PENDING");
    }

    @Test
    @DisplayName("같은 예약에 계약 재생성 → 409 CONTRACT_ALREADY_EXISTS")
    void create_twice_isConflict() throws Exception {
        createContract();

        mockMvc.perform(post("/api/v1/reservation-requests/%d/contract".formatted(reservationId))
                        .header(HttpHeaders.AUTHORIZATION, bearer(brandUserId, UserRole.BRAND)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("CONTRACT_ALREADY_EXISTS"));
    }

    @Test
    @DisplayName("예약으로 계약 조회 → 재진입 시 계약 ID 없이 같은 계약을 되찾는다")
    void findByReservation_returnsSameContract() throws Exception {
        long created = contractId();

        mockMvc.perform(get("/api/v1/reservation-requests/%d/contract".formatted(reservationId))
                        .header(HttpHeaders.AUTHORIZATION, bearer(brandUserId, UserRole.BRAND)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(created));
    }

    @Test
    @DisplayName("계약이 아직 없는 예약 조회 → 404 CONTRACT_NOT_FOUND")
    void findByReservation_beforeCreation_isNotFound() throws Exception {
        mockMvc.perform(get("/api/v1/reservation-requests/%d/contract".formatted(reservationId))
                        .header(HttpHeaders.AUTHORIZATION, bearer(brandUserId, UserRole.BRAND)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error.code").value("CONTRACT_NOT_FOUND"));
    }

    @Test
    @DisplayName("브랜드만 서명 → 아직 PENDING이고 예약도 그대로다")
    void sign_onlyBrand_staysPending() throws Exception {
        long id = contractId();

        sign(id, brandUserId, UserRole.BRAND);

        mockMvc.perform(get("/api/v1/contracts/%d".formatted(id))
                        .header(HttpHeaders.AUTHORIZATION, bearer(brandUserId, UserRole.BRAND)))
                .andExpect(jsonPath("$.data.status").value("PENDING"))
                .andExpect(jsonPath("$.data.brandSignedAt").isNotEmpty())
                .andExpect(jsonPath("$.data.landlordSignedAt").doesNotExist());
    }

    @Test
    @DisplayName("양측 서명 완료 → 계약 SIGNED, 예약 요청 CONTRACT_SIGNED")
    void sign_bothParties_completesDemoPath() throws Exception {
        long id = contractId();

        sign(id, brandUserId, UserRole.BRAND);
        sign(id, landlordUserId, UserRole.LANDLORD);

        mockMvc.perform(get("/api/v1/contracts/%d".formatted(id))
                        .header(HttpHeaders.AUTHORIZATION, bearer(landlordUserId, UserRole.LANDLORD)))
                .andExpect(jsonPath("$.data.status").value("SIGNED"));
        assertThat(reservationRequestRepository.findById(reservationId))
                .get()
                .extracting(r -> r.getStatus().name())
                .isEqualTo("CONTRACT_SIGNED");
    }

    @Test
    @DisplayName("당사자가 아닌 사용자의 서명 → 403 NOT_CONTRACT_PARTY")
    void sign_byNonParty_isForbidden() throws Exception {
        long id = contractId();
        long outsiderId = signup("flowtest-outsider@popupready.com", "제3자", UserRole.VENDOR);

        mockMvc.perform(post("/api/v1/contracts/%d/sign".formatted(id))
                        .header(HttpHeaders.AUTHORIZATION, bearer(outsiderId, UserRole.VENDOR)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error.code").value("NOT_CONTRACT_PARTY"));
    }

    @Test
    @DisplayName("당사자가 아닌 사용자의 열람 → 403(소명 자료는 당사자의 것이다)")
    void detail_byNonParty_isForbidden() throws Exception {
        long id = contractId();
        long outsiderId = signup("flowtest-outsider2@popupready.com", "제3자", UserRole.VENDOR);

        mockMvc.perform(get("/api/v1/contracts/%d".formatted(id))
                        .header(HttpHeaders.AUTHORIZATION, bearer(outsiderId, UserRole.VENDOR)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error.code").value("NOT_CONTRACT_PARTY"));
    }

    @Test
    @DisplayName("같은 당사자가 두 번 서명 → 409 CONTRACT_ALREADY_SIGNED")
    void sign_twiceBySameParty_isConflict() throws Exception {
        long id = contractId();
        sign(id, brandUserId, UserRole.BRAND);

        mockMvc.perform(post("/api/v1/contracts/%d/sign".formatted(id))
                        .header(HttpHeaders.AUTHORIZATION, bearer(brandUserId, UserRole.BRAND)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("CONTRACT_ALREADY_SIGNED"));
    }
}
