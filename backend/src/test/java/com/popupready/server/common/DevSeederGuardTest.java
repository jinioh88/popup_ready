package com.popupready.server.common;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.test.context.TestPropertySource;

/** 시드 스위치를 끄면 시더가 아예 빈으로 올라오지 않아야 한다 — 배포 환경의 안전장치다. */
@SpringBootTest
@TestPropertySource(properties = "popupready.seed.dev-data=false")
class DevSeederGuardTest {

    @Autowired
    private ApplicationContext context;

    @Test
    @DisplayName("시드 스위치가 꺼지면 → 개발 시더가 빈으로 올라오지 않는다")
    void seeders_areAbsentWhenSwitchIsOff() {
        assertThat(context.getBeanNamesForType(org.springframework.boot.ApplicationRunner.class))
                .noneMatch(name -> name.toLowerCase().contains("devseeder"));
    }
}
