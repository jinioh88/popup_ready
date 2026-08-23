package com.popupready.server.contract;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;

/**
 * 계약 무결성 해시(PRD §4 "암호화 타임스탬프", US-202).
 *
 * <p>하는 일은 하나다 — <b>"이 문서가 이 시점에 이 내용이었다"를 나중에 다시 증명하는 것.</b>
 * 그래서 두 성질이 필요하다: 같은 입력이면 언제나 같은 값(재현), 한 글자라도 다르면 다른 값(감지).
 *
 * <p><b>정본 직렬화가 이 클래스의 전부다.</b> 필드를 구분자 없이 이어붙이면 조항 경계를 옮기는
 * 것만으로 같은 해시를 만들 수 있다 — {@code ("ab","c")}와 {@code ("a","bc")}가 같은 입력이 된다.
 * 그래서 모든 필드를 개행으로 구분하고 필드 안의 개행은 이스케이프한다. 형식을 바꾸면 <b>이미
 * 저장된 계약의 해시가 전부 검증 불가</b>가 되므로, 바꿔야 한다면 템플릿 버전처럼 형식 버전을
 * 함께 올려야 한다.
 *
 * <p>이 해시는 위·변조를 <b>감지</b>할 뿐 막지는 못한다. DB를 쓸 수 있는 사람은 해시까지 다시
 * 계산해 넣을 수 있다 — 서명 키가 아니라 체크섬이다. MVP 범위에서는 이 수준으로 갈음한다.
 */
public final class ContractHasher {

    private ContractHasher() {}

    private static final String ALGORITHM = "SHA-256";

    /** 필드 구분자. 필드 안에 이 문자가 있으면 아래에서 이스케이프된다. */
    private static final String SEPARATOR = "\n";

    public static String hash(
            String templateVersion, Long reservationRequestId, List<ClauseDto> clauses, Instant issuedAt) {
        return hex(digest(canonicalize(templateVersion, reservationRequestId, clauses, issuedAt)));
    }

    /**
     * 정본 문자열. 조항은 순서까지 포함해 해시에 들어간다 — 순서를 바꾸면 계약의 의미가 달라진다.
     */
    private static String canonicalize(
            String templateVersion, Long reservationRequestId, List<ClauseDto> clauses, Instant issuedAt) {
        StringBuilder canonical = new StringBuilder();
        appendField(canonical, templateVersion);
        appendField(canonical, String.valueOf(reservationRequestId));
        appendField(canonical, issuedAt.toString());
        appendField(canonical, String.valueOf(clauses.size()));
        for (ClauseDto clause : clauses) {
            appendField(canonical, clause.title());
            appendField(canonical, clause.body());
        }
        return canonical.toString();
    }

    /** 필드 안의 역슬래시·개행을 이스케이프해 구분자와 섞이지 않게 한다. */
    private static void appendField(StringBuilder canonical, String value) {
        canonical.append(value.replace("\\", "\\\\").replace("\n", "\\n")).append(SEPARATOR);
    }

    private static byte[] digest(String canonical) {
        try {
            return MessageDigest.getInstance(ALGORITHM).digest(canonical.getBytes(StandardCharsets.UTF_8));
        } catch (NoSuchAlgorithmException e) {
            // SHA-256은 모든 JVM이 제공하도록 규격에 명시돼 있다. 여기 오면 실행 환경이 깨진 것이다.
            throw new IllegalStateException(ALGORITHM + " 알고리즘을 쓸 수 없습니다", e);
        }
    }

    private static String hex(byte[] bytes) {
        return HexFormat.of().formatHex(bytes);
    }
}
