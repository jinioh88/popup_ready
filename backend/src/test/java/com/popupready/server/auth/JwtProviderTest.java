package com.popupready.server.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Duration;
import java.time.Instant;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 토큰 발급·검증은 외부 의존이 없는 순수 로직이라 스텁 없이 검증한다.
 * 만료·위조는 시계와 키만 바꾸면 재현되므로 Clock과 secret을 주입받게 설계했다.
 */
class JwtProviderTest {

    private static final String SECRET = "test-secret-key-for-popupready-at-least-32-bytes!!";
    private static final String OTHER_SECRET = "another-secret-key-that-is-also-long-enough-32b!!";
    private static final Duration VALIDITY = Duration.ofHours(1);
    private static final Instant NOW = Instant.parse("2026-08-22T00:00:00Z");

    private JwtProvider provider(String secret, Instant now) {
        return new JwtProvider(secret, VALIDITY, () -> now);
    }

    @Test
    @DisplayName("토큰 발급 → 사용자 id와 role을 담아 되읽을 수 있다")
    void issue_carriesUserIdAndRole() {
        String token = provider(SECRET, NOW).issue(7L, UserRole.LANDLORD);

        JwtPrincipal principal = provider(SECRET, NOW).parse(token);

        assertThat(principal.userId()).isEqualTo(7L);
        assertThat(principal.role()).isEqualTo(UserRole.LANDLORD);
    }

    @Test
    @DisplayName("만료 시각을 넘긴 토큰 → 거부한다")
    void parse_expiredToken_isRejected() {
        String token = provider(SECRET, NOW).issue(7L, UserRole.BRAND);
        JwtProvider afterExpiry = provider(SECRET, NOW.plus(VALIDITY).plusSeconds(1));

        assertThatThrownBy(() -> afterExpiry.parse(token)).isInstanceOf(InvalidTokenException.class);
    }

    @Test
    @DisplayName("만료 직전 토큰 → 아직 유효하다")
    void parse_justBeforeExpiry_isAccepted() {
        String token = provider(SECRET, NOW).issue(7L, UserRole.BRAND);
        JwtProvider justBefore = provider(SECRET, NOW.plus(VALIDITY).minusSeconds(1));

        assertThat(justBefore.parse(token).userId()).isEqualTo(7L);
    }

    @Test
    @DisplayName("다른 키로 서명된 토큰 → 위조로 보고 거부한다")
    void parse_tokenSignedWithOtherKey_isRejected() {
        String forged = provider(OTHER_SECRET, NOW).issue(7L, UserRole.ADMIN);

        assertThatThrownBy(() -> provider(SECRET, NOW).parse(forged)).isInstanceOf(InvalidTokenException.class);
    }

    @Test
    @DisplayName("본문이 변조된 토큰 → 거부한다")
    void parse_tamperedToken_isRejected() {
        String token = provider(SECRET, NOW).issue(7L, UserRole.BRAND);
        String tampered = token.substring(0, token.lastIndexOf('.')) + ".tampered-signature";

        assertThatThrownBy(() -> provider(SECRET, NOW).parse(tampered)).isInstanceOf(InvalidTokenException.class);
    }

    @Test
    @DisplayName("형식이 아닌 문자열 → 거부한다")
    void parse_malformedToken_isRejected() {
        assertThatThrownBy(() -> provider(SECRET, NOW).parse("not-a-jwt")).isInstanceOf(InvalidTokenException.class);
    }
}
