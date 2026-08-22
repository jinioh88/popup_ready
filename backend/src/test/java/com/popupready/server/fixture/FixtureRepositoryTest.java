package com.popupready.server.fixture;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;

@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class FixtureRepositoryTest {

    @Autowired
    private FixtureRepository fixtureRepository;

    @Test
    @DisplayName("집기 저장 → 분류 enum이 이름 그대로 왕복된다")
    void save_roundTripsCategoryAsName() {
        Fixture saved = fixtureRepository.save(
                Fixture.create("스탠드 행거 1200", FixtureCategory.HANGER, 1_200, 500, 0, 12_000L, 40, 1L));

        assertThat(fixtureRepository.findById(saved.getId())).get().satisfies(found -> {
            assertThat(found.getCategory()).isEqualTo(FixtureCategory.HANGER);
            assertThat(found.getWidthMm()).isEqualTo(1_200);
        });
    }

    @Test
    @DisplayName("분류로 조회 → 해당 분류만 반환한다")
    void findByCategory_returnsOnlyMatchingCategory() {
        fixtureRepository.save(Fixture.create("행거", FixtureCategory.HANGER, 1_200, 500, 0, 12_000L, 40, 1L));
        fixtureRepository.save(Fixture.create("POS", FixtureCategory.POS, 900, 600, 150, 25_000L, 12, 1L));

        List<Fixture> found = fixtureRepository.findByCategory(FixtureCategory.POS);

        assertThat(found).extracting(Fixture::getCategory).containsOnly(FixtureCategory.POS);
    }
}
