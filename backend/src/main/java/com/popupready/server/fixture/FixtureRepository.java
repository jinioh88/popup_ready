package com.popupready.server.fixture;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FixtureRepository extends JpaRepository<Fixture, Long> {

    List<Fixture> findByCategory(FixtureCategory category);
}
