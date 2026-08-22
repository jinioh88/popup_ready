package com.popupready.server.auth;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.function.Supplier;
import javax.crypto.SecretKey;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Access 토큰 발급·검증. 외부 의존이 없는 순수 로직이라 스텁 없이 단위 테스트한다.
 *
 * <p>현재 시각을 {@link Supplier}로 주입받는 이유는 만료 시나리오를 시계 조작 없이 재현하기
 * 위해서다. Refresh 토큰은 Sprint 2 범위라 여기 없다.
 *
 * <p>토큰에는 <b>식별자와 역할만</b> 담는다. 이메일·이름 같은 개인정보를 실으면 토큰이 유출될 때
 * 그대로 새어나가고, 값이 바뀌어도 토큰은 낡은 값을 계속 들고 다닌다.
 */
@Component
public class JwtProvider {

    private static final String ROLE_CLAIM = "role";

    private final SecretKey key;
    private final Duration validity;
    private final Supplier<Instant> clock;

    public JwtProvider(
            @Value("${popupready.jwt.secret}") String secret,
            @Value("${popupready.jwt.validity}") Duration validity,
            Supplier<Instant> clock) {
        this.key = io.jsonwebtoken.security.Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.validity = validity;
        this.clock = clock;
    }

    public String issue(Long userId, UserRole role) {
        Instant now = clock.get();
        return Jwts.builder()
                .subject(String.valueOf(userId))
                .claim(ROLE_CLAIM, role.name())
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(validity)))
                .signWith(key)
                .compact();
    }

    /**
     * 토큰을 검증하고 신원을 꺼낸다. 만료·위조·훼손은 모두 {@link InvalidTokenException}으로
     * 같게 처리한다 — 사유를 구분해 알려주면 공격자에게 단서가 된다.
     */
    public JwtPrincipal parse(String token) {
        try {
            Claims claims = Jwts.parser()
                    .verifyWith(key)
                    .clock(() -> Date.from(clock.get()))
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
            return new JwtPrincipal(
                    Long.valueOf(claims.getSubject()), UserRole.valueOf(claims.get(ROLE_CLAIM, String.class)));
        } catch (JwtException | IllegalArgumentException e) {
            throw new InvalidTokenException("토큰을 신뢰할 수 없다", e);
        }
    }
}
