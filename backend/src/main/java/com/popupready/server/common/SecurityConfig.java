package com.popupready.server.common;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;

/**
 * ⚠️ Phase 0 한정 임시 설정 — 모든 요청을 허용한다.
 *
 * <p>이 시점의 컨트롤러는 고정 샘플을 돌려주는 계약 스텁뿐이라 보호할 데이터가 없고,
 * 웹·모바일이 /v3/api-docs와 스텁 응답에 바로 접근할 수 있어야 한다.
 *
 * <p><b>Phase 2(T2-2)에서 이 permitAll을 반드시 걷어내고</b> JWT 필터 + 역할 기반 접근 제어로
 * 교체한다. 그때 공개로 남는 것은 auth/*, GET /spaces, GET /spaces/{id}, GET /fixtures,
 * 그리고 문서 경로뿐이며 예약·계약 엔드포인트는 인증을 요구한다.
 */
@Configuration
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        return http
                // 토큰 기반 무상태 API라 CSRF 토큰 흐름이 성립하지 않는다.
                .csrf(csrf -> csrf.disable())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .httpBasic(httpBasic -> httpBasic.disable())
                .formLogin(formLogin -> formLogin.disable())
                // TODO(T2-2): JWT 필터 도입 시 제거 — 공개 경로만 permitAll로 남긴다.
                .authorizeHttpRequests(auth -> auth.anyRequest().permitAll())
                .build();
    }
}
