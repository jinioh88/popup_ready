package com.popupready.server.auth;

import com.popupready.server.common.ApiException;
import com.popupready.server.common.ErrorCode;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 가입·로그인 유스케이스.
 *
 * <p>협력자가 셋(저장소·해시·토큰)이지만 셋 다 외부에 위임하는 일이라 순수 클래스로 뽑아낼
 * 로직이 남지 않는다 — 이 클래스가 하는 일은 위임을 순서대로 엮는 것이 전부다.
 */
@Service
@Transactional(readOnly = true)
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtProvider jwtProvider;

    public AuthService(UserRepository userRepository, PasswordEncoder passwordEncoder, JwtProvider jwtProvider) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtProvider = jwtProvider;
    }

    @Transactional
    public AuthResponse signup(SignupRequest request) {
        // 유니크 제약이 최후 방어선이지만, 그것만 믿으면 DB 예외가 500으로 새어나간다.
        if (userRepository.existsByEmail(request.email())) {
            throw new ApiException(ErrorCode.EMAIL_ALREADY_EXISTS, "이미 사용 중인 이메일입니다");
        }
        User user = userRepository.save(User.create(
                request.email(), passwordEncoder.encode(request.password()), request.name(), request.role()));
        return toResponse(user);
    }

    public AuthResponse login(LoginRequest request) {
        // 이메일이 없는 경우와 비밀번호가 틀린 경우를 구분해 알려주지 않는다 —
        // 구분되면 가입된 이메일을 캐낼 수 있다(계정 열거).
        User user = userRepository
                .findByEmail(request.email())
                .filter(found -> passwordEncoder.matches(request.password(), found.getPassword()))
                .orElseThrow(() -> new ApiException(ErrorCode.INVALID_CREDENTIALS, "이메일 또는 비밀번호가 올바르지 않습니다"));
        return toResponse(user);
    }

    private AuthResponse toResponse(User user) {
        String accessToken = jwtProvider.issue(user.getId(), user.getRole());
        return new AuthResponse(
                accessToken, new UserSummary(user.getId(), user.getEmail(), user.getName(), user.getRole()));
    }
}
