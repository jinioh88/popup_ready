package com.popupready.server.common;

import static org.assertj.core.api.Assertions.assertThat;

import com.popupready.server.auth.AuthDevSeeder;
import com.popupready.server.auth.UserRepository;
import com.popupready.server.fixture.FixtureDevSeeder;
import com.popupready.server.fixture.FixtureRepository;
import com.popupready.server.space.SpaceDevSeeder;
import com.popupready.server.space.SpaceRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.boot.test.context.SpringBootTest;

/**
 * {@code ddl-auto=update}로 바꾼 뒤로는 재기동해도 데이터가 남으므로 <b>시더가 매번 다시 실행된다.</b>
 * 멱등하지 않으면 기동할 때마다 시드가 쌓인다 — data.sql을 쓰지 않기로 한 이유가 이것이라,
 * 그 성질을 테스트로 고정한다.
 *
 * <p>컨텍스트가 뜰 때 시더가 이미 한 번 실행됐으므로, 여기서 다시 부르면 2회차가 된다.
 */
@SpringBootTest
class DevSeederIdempotencyTest {

    @Autowired
    private AuthDevSeeder authDevSeeder;

    @Autowired
    private SpaceDevSeeder spaceDevSeeder;

    @Autowired
    private FixtureDevSeeder fixtureDevSeeder;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private SpaceRepository spaceRepository;

    @Autowired
    private FixtureRepository fixtureRepository;

    @Test
    @DisplayName("계정 시더를 다시 실행 → 계정 수가 늘지 않는다")
    void authSeeder_isIdempotent() {
        long before = userRepository.count();

        authDevSeeder.run(new DefaultApplicationArguments());

        assertThat(userRepository.count()).isEqualTo(before);
    }

    @Test
    @DisplayName("상가 시더를 다시 실행 → 상가 수가 늘지 않는다")
    void spaceSeeder_isIdempotent() {
        long before = spaceRepository.count();

        spaceDevSeeder.run(new DefaultApplicationArguments());

        assertThat(spaceRepository.count()).isEqualTo(before);
    }

    @Test
    @DisplayName("집기 시더를 다시 실행 → 집기 수가 늘지 않는다")
    void fixtureSeeder_isIdempotent() {
        long before = fixtureRepository.count();

        fixtureDevSeeder.run(new DefaultApplicationArguments());

        assertThat(fixtureRepository.count()).isEqualTo(before);
    }

    @Test
    @DisplayName("시드 완료 → 계정 4종·상가 10건·집기 15종이 들어 있다")
    void seeders_populateExpectedCounts() {
        assertThat(userRepository.count()).isGreaterThanOrEqualTo(4);
        assertThat(spaceRepository.count()).isGreaterThanOrEqualTo(10);
        assertThat(fixtureRepository.count()).isGreaterThanOrEqualTo(15);
    }

    @Test
    @DisplayName("시드에 INACTIVE 상가가 1건 있다 → 예약 거부 경로를 실서버에서 밟을 수 있다")
    void spaceSeed_containsInactiveSpace() {
        // 전부 ACTIVE면 웹이 "비활성 공간 예약 400" 경로를 실검증할 수 없다(웹 요청, 2026-08-23).
        assertThat(spaceRepository.findAll())
                .anyMatch(space -> space.getStatus() == com.popupready.server.space.SpaceStatus.INACTIVE);
    }

    @Test
    @DisplayName("INACTIVE 상가 → 반경 검색 결과에 나오지 않는다")
    void inactiveSpace_isExcludedFromSearch() {
        // 검색은 ACTIVE만 돌려준다. 이 시드가 그 규칙을 깨지 않는지 함께 확인한다.
        assertThat(spaceRepository.searchWithin(37.5445, 127.0557, 50_000, null, null, null))
                .allMatch(space -> space.getStatus() == com.popupready.server.space.SpaceStatus.ACTIVE);
    }
}
