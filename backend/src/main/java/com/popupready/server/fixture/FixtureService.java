package com.popupready.server.fixture;

import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 집기 라이브러리 조회. 분류가 없으면 전체를 돌려준다. */
@Service
@Transactional(readOnly = true)
public class FixtureService {

    private final FixtureRepository fixtureRepository;

    public FixtureService(FixtureRepository fixtureRepository) {
        this.fixtureRepository = fixtureRepository;
    }

    public List<FixtureResponse> list(FixtureCategory category) {
        List<Fixture> fixtures =
                (category == null) ? fixtureRepository.findAll() : fixtureRepository.findByCategory(category);
        return fixtures.stream().map(FixtureService::toResponse).toList();
    }

    private static FixtureResponse toResponse(Fixture fixture) {
        return new FixtureResponse(
                fixture.getId(),
                fixture.getName(),
                fixture.getCategory(),
                fixture.getWidthMm(),
                fixture.getDepthMm(),
                fixture.getPowerWatt(),
                fixture.getDailyRentalFee(),
                fixture.getStockQty());
    }
}
