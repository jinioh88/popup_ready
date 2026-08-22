package com.popupready.server.fixture;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.BDDMockito.given;

import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class FixtureServiceTest {

    @Mock
    private FixtureRepository fixtureRepository;

    @InjectMocks
    private FixtureService fixtureService;

    private Fixture hanger() {
        return Fixture.create("스탠드 행거 1200", FixtureCategory.HANGER, 1_200, 500, 0, 12_000L, 40, 1L);
    }

    @Test
    @DisplayName("분류 없이 조회 → 전체를 가져온다")
    void list_withoutCategory_fetchesAll() {
        given(fixtureRepository.findAll()).willReturn(List.of(hanger()));

        assertThat(fixtureService.list(null)).singleElement().satisfies(response -> {
            assertThat(response.name()).isEqualTo("스탠드 행거 1200");
            assertThat(response.widthMm()).isEqualTo(1_200);
            assertThat(response.powerWatt()).isZero();
        });
    }

    @Test
    @DisplayName("분류를 주면 → 그 분류만 가져온다")
    void list_withCategory_fetchesOnlyThatCategory() {
        given(fixtureRepository.findByCategory(FixtureCategory.HANGER)).willReturn(List.of(hanger()));

        assertThat(fixtureService.list(FixtureCategory.HANGER))
                .extracting(FixtureResponse::category)
                .containsOnly(FixtureCategory.HANGER);
    }

    @Test
    @DisplayName("ID 목록으로 조회 → 그 집기들만 가져온다")
    void findAllByIds_fetchesOnlyRequested() {
        given(fixtureRepository.findAllById(List.of(3L))).willReturn(List.of(hanger()));

        // 엔티티 ID는 영속 시점에 채워지므로 여기서는 매핑이 이뤄졌는지만 본다.
        assertThat(fixtureService.findAllByIds(List.of(3L)))
                .extracting(FixtureResponse::name)
                .containsExactly("스탠드 행거 1200");
    }

    @Test
    @DisplayName("없는 ID가 섞임 → 찾은 것만 돌려준다(빠진 것의 판정은 호출자 몫)")
    void findAllByIds_missingId_returnsFoundOnly() {
        given(fixtureRepository.findAllById(List.of(3L, 999L))).willReturn(List.of(hanger()));

        assertThat(fixtureService.findAllByIds(List.of(3L, 999L))).hasSize(1);
    }
}
