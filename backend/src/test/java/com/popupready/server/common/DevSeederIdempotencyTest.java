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
    @DisplayName("시드 완료 → 계정 4종·상가 9건·집기 15종이 들어 있다")
    void seeders_populateExpectedCounts() {
        assertThat(userRepository.count()).isGreaterThanOrEqualTo(4);
        assertThat(spaceRepository.count()).isGreaterThanOrEqualTo(9);
        assertThat(fixtureRepository.count()).isGreaterThanOrEqualTo(15);
    }
}
