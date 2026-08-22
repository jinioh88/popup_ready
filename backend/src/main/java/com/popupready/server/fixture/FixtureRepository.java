package com.popupready.server.fixture;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FixtureRepository extends JpaRepository<Fixture, Long> {

    /** 시드가 이미 들어갔는지 항목별로 판단할 때 쓴다. */
    boolean existsByName(String name);

    List<Fixture> findByCategory(FixtureCategory category);
}
