package com.popupready.server.space;

import com.popupready.server.auth.AuthDevSeeder;
import com.popupready.server.auth.UserService;
import java.math.BigDecimal;
import java.util.List;
import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.Point;
import org.locationtech.jts.geom.PrecisionModel;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * 성수·명동·홍대 일대 상가 시드(스프린트 문서 §4의 5번). ACTIVE 9건 + INACTIVE 1건.
 *
 * <p>좌표를 코드에서 만들기 때문에 WKT 문자열을 손으로 적지 않아도 되고, SRID가 어긋날 여지가 없다.
 * 건물주 계정은 {@link UserService}를 통해 찾는다 — {@code auth}의 리포지토리를 직접 보지 않는다.
 *
 * <p><b>실행 가드</b>: {@code popupready.seed.dev-data=true}일 때만 동작한다. 로컬
 * application.properties에만 켜져 있고 배포 환경에는 없다 — 가드가 없으면 알려진 비밀번호로
 * 로그인되는 ADMIN 계정이 배포 환경에 조용히 생긴다.
 */
@Component
@ConditionalOnProperty(name = "popupready.seed.dev-data", havingValue = "true")
@Order(2)
public class SpaceDevSeeder implements ApplicationRunner {

    private static final GeometryFactory GEOMETRY_FACTORY = new GeometryFactory(new PrecisionModel(), 4326);

    private static final BigDecimal DEPOSIT_RATE = new BigDecimal("0.10");

    private static final Logger log = LoggerFactory.getLogger(SpaceDevSeeder.class);

    private final SpaceRepository spaceRepository;
    private final UserService userService;

    public SpaceDevSeeder(SpaceRepository spaceRepository, UserService userService) {
        this.spaceRepository = spaceRepository;
        this.userService = userService;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        // 항목별로 확인한다 — 테이블이 비었는지로 판단하면 데이터가 한 건이라도 있을 때
        // 시드가 영영 들어가지 않는다.
        Long ownerId = userService.findIdByEmail(AuthDevSeeder.LANDLORD_EMAIL).orElse(null);
        if (ownerId == null) {
            log.warn("건물주 계정이 없어 상가 시드를 건너뛴다");
            return;
        }
        List<Space> seeds = List.of(
                // 성수 — 팝업 성지. 좌표는 연무장길·서울숲 일대다.
                space("성수 연무장길 팝업 1층", "서울 성동구 연무장길 45", 37.5445, 127.0557, 450_000L, 82.5, 5_000, 20, 12, ownerId),
                space("성수 서울숲길 코너샵", "서울 성동구 서울숲길 17", 37.5471, 127.0433, 380_000L, 61.0, 4_000, 16, 10, ownerId),
                space("성수 아틀리에길 지하", "서울 성동구 아차산로 63", 37.5423, 127.0561, 300_000L, 95.0, 6_000, 24, 14, ownerId),
                // 명동 — 관광 상권. 임대료가 높고 면적이 작다.
                space("명동 유네스코길 스트리트 스토어", "서울 중구 명동길 26", 37.5636, 126.9827, 780_000L, 41.0, 4_000, 12, 8, ownerId),
                space("명동 중앙로 1층", "서울 중구 명동8길 12", 37.5608, 126.9852, 920_000L, 55.0, 5_500, 14, 10, ownerId),
                space("명동 눈스퀘어 인근 소형", "서울 중구 명동7길 13", 37.5641, 126.9839, 640_000L, 28.0, 3_000, 10, 7, ownerId),
                // 홍대 — 젊은 상권. 지하·복층이 많다.
                space("홍대 걷고싶은거리 팝업존", "서울 마포구 양화로 152", 37.5551, 126.9236, 520_000L, 73.0, 5_000, 18, 12, ownerId),
                space("홍대 연남동 골목", "서울 마포구 성미산로 161", 37.5626, 126.9256, 340_000L, 48.0, 3_500, 14, 9, ownerId),
                space("홍대 상수동 리버뷰", "서울 마포구 와우산로 21", 37.5478, 126.9223, 410_000L, 66.0, 4_500, 16, 11, ownerId),
                // 운영이 끝난 공간 1건. 시드가 전부 ACTIVE면 "비활성 공간 예약 거부(400)" 경로를
                // 실서버에서 밟을 수 없다(웹 요청, 2026-08-23). 검색에는 나오지 않지만 상세 조회는
                // 공개라 ID만 알면 부를 수 있는 — 바로 그 거부 규칙이 필요한 상태다.
                inactive(space(
                        "성수 뚝섬역 구 팝업 (운영 종료)",
                        "서울 성동구 아차산로 5",
                        37.5474,
                        127.0475,
                        360_000L,
                        58.0,
                        4_000,
                        16,
                        10,
                        ownerId)));
        List<Space> missing = seeds.stream()
                .filter(seed -> !spaceRepository.existsByName(seed.getName()))
                .toList();
        if (!missing.isEmpty()) {
            spaceRepository.saveAll(missing);
            log.info("상가 시드 {}건을 넣었다", missing.size());
        }
    }

    /** 시드 단계에서만 쓰는 상태 조정. 엔티티의 상태 전이 메서드를 통해서만 바꾼다. */
    private Space inactive(Space space) {
        space.deactivate();
        return space;
    }

    private Space space(
            String name,
            String address,
            double lat,
            double lng,
            long dailyRent,
            double floorAreaM2,
            int maxPowerWatt,
            int gridCols,
            int gridRows,
            Long ownerId) {
        Point location = GEOMETRY_FACTORY.createPoint(new Coordinate(lng, lat));
        return Space.create(
                name,
                address,
                location,
                dailyRent,
                DEPOSIT_RATE,
                floorAreaM2,
                maxPowerWatt,
                gridCols,
                gridRows,
                500,
                ownerId);
    }
}
