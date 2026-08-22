package com.popupready.server.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.popupready.server.common.ApiException;
import com.popupready.server.common.ErrorCode;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * 협력자가 셋(저장소·해시·토큰)이라 CLAUDE.md의 "스텁 3개 = 설계 신호"에 걸린다. 검토했으나
 * 셋 다 <b>외부에 위임하는 일</b>(영속·해싱·서명)이라 순수 클래스로 뽑아낼 로직이 남지 않는다.
 * 가입·로그인은 이 위임들을 순서대로 엮는 것이 전부이므로 분리하지 않는다.
 */
@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private JwtProvider jwtProvider;

    @InjectMocks
    private AuthService authService;

    private User savedUser() {
        return User.create("brand@popupready.com", "hashed", "김브랜드", UserRole.BRAND);
    }

    @Test
    @DisplayName("새 이메일로 가입 → 비밀번호를 해시해 저장한다")
    void signup_hashesPasswordBeforeSaving() {
        given(userRepository.existsByEmail("brand@popupready.com")).willReturn(false);
        given(passwordEncoder.encode("password123")).willReturn("hashed");
        given(userRepository.save(any(User.class))).willReturn(savedUser());

        authService.signup(new SignupRequest("brand@popupready.com", "password123", "김브랜드", UserRole.BRAND));

        verify(passwordEncoder).encode("password123");
    }

    @Test
    @DisplayName("이미 쓰는 이메일로 가입 → EMAIL_ALREADY_EXISTS로 거부하고 저장하지 않는다")
    void signup_duplicateEmail_isRejectedWithoutSaving() {
        given(userRepository.existsByEmail("brand@popupready.com")).willReturn(true);

        assertThatThrownBy(() -> authService.signup(
                        new SignupRequest("brand@popupready.com", "password123", "김브랜드", UserRole.BRAND)))
                .isInstanceOf(ApiException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.EMAIL_ALREADY_EXISTS);

        verify(userRepository, never()).save(any());
    }

    @Test
    @DisplayName("올바른 자격 증명으로 로그인 → 토큰을 발급한다")
    void login_withValidCredentials_issuesToken() {
        given(userRepository.findByEmail("brand@popupready.com")).willReturn(Optional.of(savedUser()));
        given(passwordEncoder.matches("password123", "hashed")).willReturn(true);
        given(jwtProvider.issue(any(), any())).willReturn("issued-token");

        AuthResponse response = authService.login(new LoginRequest("brand@popupready.com", "password123"));

        assertThat(response.accessToken()).isEqualTo("issued-token");
    }

    @Test
    @DisplayName("비밀번호가 틀린 로그인 → INVALID_CREDENTIALS로 거부한다")
    void login_withWrongPassword_isRejected() {
        given(userRepository.findByEmail("brand@popupready.com")).willReturn(Optional.of(savedUser()));
        given(passwordEncoder.matches("wrong", "hashed")).willReturn(false);

        assertThatThrownBy(() -> authService.login(new LoginRequest("brand@popupready.com", "wrong")))
                .isInstanceOf(ApiException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.INVALID_CREDENTIALS);
    }

    @Test
    @DisplayName("없는 이메일로 로그인 → 비밀번호 오류와 같은 INVALID_CREDENTIALS로 거부한다")
    void login_withUnknownEmail_isRejectedIndistinguishably() {
        // 존재 여부를 구분해 알려주면 가입된 이메일을 캐낼 수 있다(계정 열거).
        given(userRepository.findByEmail("nobody@popupready.com")).willReturn(Optional.empty());

        assertThatThrownBy(() -> authService.login(new LoginRequest("nobody@popupready.com", "password123")))
                .isInstanceOf(ApiException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.INVALID_CREDENTIALS);
    }

    @Test
    @DisplayName("없는 이메일로 로그인 → 해시 검증을 건너뛰지 않는다(응답 시간으로 가입 여부가 드러나지 않게)")
    void login_withUnknownEmail_stillPaysHashingCost() {
        given(userRepository.findByEmail("nobody@popupready.com")).willReturn(Optional.empty());

        assertThatThrownBy(() -> authService.login(new LoginRequest("nobody@popupready.com", "password123")))
                .isInstanceOf(ApiException.class);

        verify(passwordEncoder).matches(eq("password123"), any());
    }
}
