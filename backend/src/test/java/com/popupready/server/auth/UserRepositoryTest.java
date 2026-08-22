package com.popupready.server.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.dao.DataIntegrityViolationException;

/**
 * 로컬 docker PostGIS 대상 슬라이스 테스트(H2 대체 불가 — infra compose 기동이 전제다).
 * 스키마는 ddl-auto가 만든다.
 *
 * <p><b>이메일에 {@code repotest-} 접두를 붙이는 이유</b>: {@code ddl-auto=update}로 바꾼 뒤로는
 * 테스트가 개발용 시드와 같은 DB를 공유한다. 시드 계정과 같은 이메일을 쓰면 유니크 제약에 걸려
 * 테스트가 깨진다 — 실제로 시드를 넣자마자 이 테스트가 먼저 터졌다.
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class UserRepositoryTest {

    @Autowired
    private UserRepository userRepository;

    @Test
    @DisplayName("사용자 저장 → 식별자가 부여되고 조회로 왕복된다")
    void save_assignsIdAndRoundTrips() {
        User saved =
                userRepository.save(User.create("repotest-brand@popupready.com", "hashed", "김브랜드", UserRole.BRAND));

        assertThat(saved.getId()).isNotNull();
        assertThat(userRepository.findById(saved.getId())).get().satisfies(found -> {
            assertThat(found.getEmail()).isEqualTo("repotest-brand@popupready.com");
            assertThat(found.getRole()).isEqualTo(UserRole.BRAND);
        });
    }

    @Test
    @DisplayName("같은 이메일 중복 저장 → 유니크 제약 위반")
    void save_duplicateEmail_violatesUniqueConstraint() {
        // DB 제약은 최후 방어선이다. 실제 가입 흐름은 existsByEmail로 먼저 걸러
        // 409 EMAIL_ALREADY_EXISTS를 돌려준다(T2-3).
        // saveAndFlush로 저장해야 Spring Data 프록시가 Hibernate 예외를 변환한다 —
        // EntityManager.flush()를 직접 부르면 변환 없이 Hibernate 예외가 그대로 나온다.
        userRepository.saveAndFlush(User.create("repotest-dup@popupready.com", "hashed", "김브랜드", UserRole.BRAND));

        assertThatThrownBy(() -> userRepository.saveAndFlush(
                        User.create("repotest-dup@popupready.com", "hashed", "박건물주", UserRole.LANDLORD)))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    @DisplayName("이메일로 조회 → 해당 사용자를 찾는다")
    void findByEmail_returnsMatchingUser() {
        userRepository.save(User.create("repotest-lookup@popupready.com", "hashed", "김브랜드", UserRole.BRAND));

        assertThat(userRepository.findByEmail("repotest-lookup@popupready.com")).isPresent();
    }

    @Test
    @DisplayName("없는 이메일로 조회 → 빈 결과")
    void findByEmail_unknownEmail_returnsEmpty() {
        assertThat(userRepository.findByEmail("repotest-nobody@popupready.com")).isEmpty();
    }
}
