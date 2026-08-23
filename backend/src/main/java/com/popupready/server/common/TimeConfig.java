package com.popupready.server.common;

import java.time.Instant;
import java.util.function.Supplier;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * 현재 시각 공급자. 시간 의존 로직(토큰 만료, 계약 발행·서명 시각)을 시계 조작 없이 테스트하기
 * 위해 주입 가능한 형태로 둔다.
 *
 * <p>원래 {@code auth}에 있었으나 계약 서명(US-202)이 같은 것을 필요로 하면서 {@code common}으로
 * 옮겼다 — 도메인 하나가 다른 도메인의 설정 빈에 기대는 모양이 되면 경계가 흐려진다.
 * 타입으로 주입되므로 옮겨도 쓰는 쪽은 바뀌지 않는다.
 */
@Configuration
public class TimeConfig {

    @Bean
    public Supplier<Instant> currentInstant() {
        return Instant::now;
    }
}
