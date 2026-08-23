package com.popupready.server.common;

import com.popupready.server.auth.JwtAuthenticationFilter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

/**
 * 인증·인가 경계. <b>기본값은 "인증 필요"이고, 공개 경로만 예외로 열거한다</b> — 반대로 짜면
 * 새 엔드포인트가 실수로 공개된다.
 *
 * <p>공개로 두는 것은 셋뿐이다: ① 가입·로그인(인증을 얻는 경로라 인증을 요구할 수 없다)
 * ② 공간·집기 탐색(로그인 전에 둘러보는 것이 US-101의 전제다) ③ API 문서.
 * 예약·계약은 당사자만 다루므로 전부 인증을 요구한다.
 *
 * <p>어느 경로가 열려 있는지는 {@code SecurityAccessTest}가 못 박고 있다. 여기를 고치면
 * 그 테스트도 함께 고쳐야 하며, 그것이 의도된 마찰이다.
 */
@Configuration
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(
            HttpSecurity http,
            JwtAuthenticationFilter jwtAuthenticationFilter,
            ApiAuthenticationEntryPoint authenticationEntryPoint,
            ApiAccessDeniedHandler accessDeniedHandler)
            throws Exception {
        return http
                // 토큰 기반 무상태 API라 CSRF 토큰 흐름이 성립하지 않는다.
                .csrf(csrf -> csrf.disable())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .httpBasic(httpBasic -> httpBasic.disable())
                .formLogin(formLogin -> formLogin.disable())
                // 공개 경로 목록은 PublicEndpoints가, 역할 제한 목록은 RestrictedEndpoints가
                // 단일 진실이다 — OpenAPI 문서의 401·403 표기도 같은 목록을 본다.
                .authorizeHttpRequests(auth -> {
                    auth.requestMatchers(PublicEndpoints.AUTH_ANT)
                            .permitAll()
                            .requestMatchers(HttpMethod.GET, PublicEndpoints.DISCOVERY_GET_ANT)
                            .permitAll()
                            .requestMatchers(PublicEndpoints.DOCS_ANT)
                            .permitAll();
                    // 예: 예약을 만드는 것은 브랜드 운영자다. 인증만 통과하면 누구나 되는 상태로
                    // 두면 건물주·공급사 계정으로도 예약이 생성된다.
                    for (RestrictedEndpoints.RoleRule rule : RestrictedEndpoints.ROLE_RULES) {
                        auth.requestMatchers(rule.method(), rule.antPattern())
                                .hasRole(rule.role().name());
                    }
                    // 계약 열람·서명은 역할이 아니라 '당사자인가'로 갈린다. 브랜드와 건물주 양쪽이
                    // 접근해야 하므로 여기서는 인증까지만 보고, 당사자 검증은 ContractService가 한다.
                    auth.anyRequest().authenticated();
                })
                // 401·403은 필터 단계라 GlobalExceptionHandler가 잡지 못한다. 봉투 형태를 여기서 맞춘다.
                .exceptionHandling(handling -> handling.authenticationEntryPoint(authenticationEntryPoint)
                        .accessDeniedHandler(accessDeniedHandler))
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)
                .build();
    }

    /** 비밀번호는 BCrypt 해시로만 저장한다. 평문 비교 경로를 만들지 않는다. */
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
