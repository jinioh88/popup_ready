package com.popupready.server.auth;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * 개발용 테스트 계정 4종(스프린트 문서 §4의 5번).
 *
 * <p><b>비어 있을 때만 넣는다.</b> {@code ddl-auto=update}로 바꾼 뒤로는 재기동해도 데이터가 남아
 * data.sql 방식이면 매번 중복 삽입된다. 코드로 넣는 또 다른 이유는 <b>BCrypt 해시를 하드코딩하지
 * 않아도 되기 때문</b>이다 — 실제 인코더로 만들어 비밀번호를 팀에 그대로 공유할 수 있다.
 *
 * <p>공간·집기 시더가 이 계정들의 식별자를 owner/vendor로 쓰므로 가장 먼저 실행한다.
 */
@Component
@Order(1)
public class AuthDevSeeder implements ApplicationRunner {

    /** 팀 공유용 개발 계정 비밀번호. 로컬 전용이며 배포 환경에는 이 시더가 돌지 않아야 한다. */
    public static final String DEV_PASSWORD = "password123";

    public static final String BRAND_EMAIL = "brand@popupready.com";
    public static final String LANDLORD_EMAIL = "landlord@popupready.com";
    public static final String VENDOR_EMAIL = "vendor@popupready.com";
    public static final String ADMIN_EMAIL = "admin@popupready.com";

    private static final Logger log = LoggerFactory.getLogger(AuthDevSeeder.class);

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public AuthDevSeeder(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        // "테이블이 비었는가"로 판단하면 누군가 가입을 한 번만 해도 시드가 영영 안 들어간다.
        // 항목별로 확인해야 부분적으로 지워진 경우에도 제자리를 찾는다.
        int created = 0;
        created += createIfAbsent(BRAND_EMAIL, "김브랜드", UserRole.BRAND);
        created += createIfAbsent(LANDLORD_EMAIL, "박건물주", UserRole.LANDLORD);
        created += createIfAbsent(VENDOR_EMAIL, "이공급", UserRole.VENDOR);
        created += createIfAbsent(ADMIN_EMAIL, "최관리", UserRole.ADMIN);
        if (created > 0) {
            log.info("개발 계정 {}종을 시드했다(비밀번호는 모두 {})", created, DEV_PASSWORD);
        }
    }

    private int createIfAbsent(String email, String name, UserRole role) {
        if (userRepository.existsByEmail(email)) {
            return 0;
        }
        userRepository.save(User.create(email, passwordEncoder.encode(DEV_PASSWORD), name, role));
        return 1;
    }
}
