package com.popupready.server.auth;

import java.time.Instant;
import java.util.function.Supplier;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * 현재 시각 공급자. 토큰 만료 같은 시간 의존 로직을 시계 조작 없이 테스트하기 위해
 * 주입 가능한 형태로 둔다.
 */
@Configuration
public class AuthTimeConfig {

    @Bean
    public Supplier<Instant> currentInstant() {
        return Instant::now;
    }
}
