package com.popupready.server.fixture;

import com.popupready.server.auth.AuthDevSeeder;
import com.popupready.server.auth.UserService;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * 모듈러 집기 시드(스프린트 문서 §4의 5번). 규격(mm)·소비전력(W)·렌털료는 현실적인 값으로 잡았다 —
 * 빌더의 점유 셀 계산과 Sprint 2의 전력 합산이 이 값으로 돌아간다.
 *
 * <p><b>실행 가드</b>: {@code popupready.seed.dev-data=true}일 때만 동작한다. 로컬
 * application.properties에만 켜져 있고 배포 환경에는 없다 — 가드가 없으면 알려진 비밀번호로
 * 로그인되는 ADMIN 계정이 배포 환경에 조용히 생긴다.
 */
@Component
@ConditionalOnProperty(name = "popupready.seed.dev-data", havingValue = "true")
@Order(2)
public class FixtureDevSeeder implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(FixtureDevSeeder.class);

    private final FixtureRepository fixtureRepository;
    private final UserService userService;

    public FixtureDevSeeder(FixtureRepository fixtureRepository, UserService userService) {
        this.fixtureRepository = fixtureRepository;
        this.userService = userService;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        // 항목별로 확인한다 — 테이블이 비었는지로 판단하면 데이터가 한 건이라도 있을 때
        // 시드가 영영 들어가지 않는다.
        Long vendorId = userService.findIdByEmail(AuthDevSeeder.VENDOR_EMAIL).orElse(null);
        if (vendorId == null) {
            log.warn("공급사 계정이 없어 집기 시드를 건너뛴다");
            return;
        }
        List<Fixture> seeds = List.of(
                // 행거 — 의류 진열. 비전기라 powerWatt 0이다.
                fixture("스탠드 행거 1200", FixtureCategory.HANGER, 1_200, 500, 0, 12_000L, 40, vendorId),
                fixture("이단 행거 900", FixtureCategory.HANGER, 900, 500, 0, 9_000L, 35, vendorId),
                fixture("벽면 행거바 1500", FixtureCategory.HANGER, 1_500, 300, 0, 14_000L, 20, vendorId),
                // POS — 결제 단말
                fixture("POS 카운터 900", FixtureCategory.POS, 900, 600, 150, 25_000L, 12, vendorId),
                fixture("태블릿 POS 스탠드", FixtureCategory.POS, 400, 400, 40, 15_000L, 18, vendorId),
                // 쇼케이스 — 유리 진열장
                fixture("유리 쇼케이스 1000", FixtureCategory.SHOWCASE, 1_000, 500, 90, 30_000L, 18, vendorId),
                fixture("냉장 쇼케이스 1200", FixtureCategory.SHOWCASE, 1_200, 650, 450, 55_000L, 8, vendorId),
                fixture("아크릴 큐브 진열", FixtureCategory.SHOWCASE, 400, 400, 0, 8_000L, 50, vendorId),
                // 조명
                fixture("트랙 조명 3구", FixtureCategory.LIGHTING, 300, 300, 120, 8_000L, 60, vendorId),
                fixture("스탠드 조명", FixtureCategory.LIGHTING, 350, 350, 60, 6_000L, 45, vendorId),
                fixture("네온 사인 패널", FixtureCategory.LIGHTING, 800, 100, 80, 20_000L, 15, vendorId),
                // 진열대
                fixture("우드 진열대 1200", FixtureCategory.SHELF, 1_200, 450, 0, 16_000L, 30, vendorId),
                fixture("철제 앵글 선반 900", FixtureCategory.SHELF, 900, 400, 0, 11_000L, 40, vendorId),
                fixture("아일랜드 테이블 1500", FixtureCategory.SHELF, 1_500, 800, 0, 28_000L, 14, vendorId),
                // 기타
                fixture("피팅룸 부스", FixtureCategory.ETC, 1_000, 1_000, 30, 35_000L, 10, vendorId));
        List<Fixture> missing = seeds.stream()
                .filter(seed -> !fixtureRepository.existsByName(seed.getName()))
                .toList();
        if (!missing.isEmpty()) {
            fixtureRepository.saveAll(missing);
            log.info("집기 시드 {}건을 넣었다", missing.size());
        }
    }

    private Fixture fixture(
            String name,
            FixtureCategory category,
            int widthMm,
            int depthMm,
            int powerWatt,
            long dailyRentalFee,
            int stockQty,
            Long vendorId) {
        return Fixture.create(name, category, widthMm, depthMm, powerWatt, dailyRentalFee, stockQty, vendorId);
    }
}
