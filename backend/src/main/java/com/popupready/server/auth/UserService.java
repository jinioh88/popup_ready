package com.popupready.server.auth;

import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 다른 도메인이 사용자 정보를 볼 때 통과하는 창구.
 *
 * <p>{@code space}·{@code fixture}·{@code contract}는 {@link UserRepository}를 직접 참조하지 않는다
 * (패키지 경계 규칙). 필요한 것만 여기서 열어준다.
 */
@Service
@Transactional(readOnly = true)
public class UserService {

    private final UserRepository userRepository;

    public UserService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    /** 시드·소유자 연결에 쓰는 식별자 조회. 없으면 빈 값이다. */
    public Optional<Long> findIdByEmail(String email) {
        return userRepository.findByEmail(email).map(User::getId);
    }
}
