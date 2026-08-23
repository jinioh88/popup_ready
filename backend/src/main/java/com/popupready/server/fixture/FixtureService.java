package com.popupready.server.fixture;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
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

    /**
     * 지목된 집기들의 규격. 요청한 ID 중 없는 것은 <b>조용히 빠진 채로</b> 돌아온다 —
     * 무엇이 빠졌을 때 어떻게 할지는 부르는 쪽의 규칙이다(예약은 400으로 거절한다).
     */
    /**
     * 집기별 공급사 식별자(US-203). 정산이 공급사별로 Row를 나누려면 필요한데,
     * {@link FixtureResponse}에는 넣지 않는다 — 빌더 팔레트가 쓸 값이 아니고, 응답에 넣는 순간
     * API 계약이 되어 바꾸기 어려워진다.
     */
    public Map<Long, Long> findVendorIds(Collection<Long> ids) {
        return fixtureRepository.findAllById(ids).stream()
                .collect(Collectors.toMap(Fixture::getId, Fixture::getVendorId));
    }

    public List<FixtureResponse> findAllByIds(Collection<Long> ids) {
        return fixtureRepository.findAllById(ids).stream()
                .map(FixtureService::toResponse)
                .toList();
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
