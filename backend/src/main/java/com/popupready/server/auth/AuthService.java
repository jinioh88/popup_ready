package com.popupready.server.auth;

import com.popupready.server.common.ApiException;
import com.popupready.server.common.ErrorCode;
import java.util.UUID;
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

    /**
     * 존재하지 않는 계정으로 로그인을 시도할 때 비교 대상으로 쓰는 더미 해시.
     *
     * <p>어떤 비밀번호와도 일치하지 않으며, 실제 계정과 같은 BCrypt 비용을 치르게 해서
     * 응답 시간으로 가입 여부가 드러나지 않게 한다.
     */
    private static final String DUMMY_PASSWORD_HASH = "$2a$10$ABCDEFGHIJKLMNOPQRSTUOxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtProvider jwtProvider;

    /**
     * 존재하지 않는 계정으로 로그인을 시도할 때 비교 대상으로 쓰는 더미 해시.
     *
     * <p>기동 시 임의의 값으로 <b>실제로 생성한다</b>. 상수로 손수 적어 넣으면 형식이 어긋나기 쉽고,
     * 그러면 인코더가 검증을 건너뛰고 즉시 false를 돌려줘 시간을 맞추려던 목적이 사라진다
     * (실제로 그렇게 만들었다가 "does not look like BCrypt" 경고로 발견했다).
     */
    private final String dummyPasswordHash;

    public AuthService(UserRepository userRepository, PasswordEncoder passwordEncoder, JwtProvider jwtProvider) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtProvider = jwtProvider;
        this.dummyPasswordHash = passwordEncoder.encode(UUID.randomUUID().toString());
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
        User user = userRepository.findByEmail(request.email()).orElse(null);

        // 응답 내용만 같게 해서는 부족하다. 계정이 없을 때 해시 검증을 건너뛰면 응답이 눈에 띄게
        // 빨라져 시간 차이만으로 가입 여부가 드러난다. 없는 계정에도 같은 비용을 치른다.
        String encodedPassword = (user != null) ? user.getPassword() : dummyPasswordHash;
        boolean matched = passwordEncoder.matches(request.password(), encodedPassword);

        if (user == null || !matched) {
            throw new ApiException(ErrorCode.INVALID_CREDENTIALS, "이메일 또는 비밀번호가 올바르지 않습니다");
        }
        return toResponse(user);
    }

    private AuthResponse toResponse(User user) {
        String accessToken = jwtProvider.issue(user.getId(), user.getRole());
        return new AuthResponse(
                accessToken, new UserSummary(user.getId(), user.getEmail(), user.getName(), user.getRole()));
    }
}
