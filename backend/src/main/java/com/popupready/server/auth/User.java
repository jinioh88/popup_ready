package com.popupready.server.auth;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 플랫폼 사용자(스프린트 문서 §2.1).
 *
 * <p>{@code user}는 PostgreSQL 예약어라 테이블명을 {@code users}로 둔다.
 *
 * <p><b>비밀번호는 BCrypt 해시만 담는다.</b> 평문이 이 필드에 들어오면 그대로 저장되므로,
 * 해싱은 이 엔티티를 만들기 전에 끝나 있어야 한다(생성 인자 이름을 encodedPassword로 둔 이유).
 */
@Entity
@Table(name = "users")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(nullable = false)
    private String password;

    @Column(nullable = false)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private UserRole role;

    private User(String email, String encodedPassword, String name, UserRole role) {
        this.email = email;
        this.password = encodedPassword;
        this.name = name;
        this.role = role;
    }

    public static User create(String email, String encodedPassword, String name, UserRole role) {
        return new User(email, encodedPassword, name, role);
    }
}
