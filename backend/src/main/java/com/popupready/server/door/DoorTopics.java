package com.popupready.server.door;

import java.util.regex.Pattern;

/**
 * MQTT 토픽 조립(§2.3). <b>토픽을 만드는 곳은 프로젝트 전체에서 여기 하나다.</b>
 *
 * <p>클라이언트는 서버가 내려준 문자열을 그대로 발행·구독하고 스스로 만들지 않는다. 모바일은
 * 아예 조립 함수를 삭제해 그 규범을 코드로 못 박았고, 발행 문자열을 만드는 이쪽에도 같은 제약이
 * 서야 두 겹이 된다.
 *
 * <p><b>와일드카드를 거절하는 이유</b>는 발행보다 구독 쪽이 나쁘기 때문이다 — {@code +}로 발행하면
 * 브로커가 거절할 수 있지만(그 거절은 브로커 설정에 달려 있어 환경이 바뀌면 함께 바뀐다),
 * {@code +}로 구독하면 <b>조용히 성공하면서 남의 공간 상태를 받아온다.</b>
 *
 * <p>지금은 {@code spaceId}가 {@code Long}이라 타입이 이미 막고 있다. 그래도 검사를 두는 것은,
 * 막고 있는 것이 <b>의도된 방어가 아니라 우연한 타입 선택</b>이기 때문이다 — 식별자가 slug나
 * 외부 ID로 바뀌는 순간 아무 경고 없이 뚫린다.
 */
public final class DoorTopics {

    private static final String PREFIX = "popupready/locks/";

    /** MQTT 와일드카드({@code + #})와 구분자({@code /})가 섞일 수 없는 문자만 허용한다. */
    private static final Pattern SAFE_SEGMENT = Pattern.compile("[A-Za-z0-9_-]+");

    private DoorTopics() {}

    /** 모바일이 발행할 명령 토픽. */
    public static String command(String spaceSegment) {
        return PREFIX + requireSafe(spaceSegment) + "/command";
    }

    /** 모바일이 구독할 상태 토픽. 구독 실패는 개방 흐름을 막지 않는다(UI 편의). */
    public static String status(String spaceSegment) {
        return PREFIX + requireSafe(spaceSegment) + "/status";
    }

    private static String requireSafe(String spaceSegment) {
        if (spaceSegment == null || !SAFE_SEGMENT.matcher(spaceSegment).matches()) {
            throw new IllegalArgumentException("토픽에 쓸 수 없는 공간 식별자입니다: %s".formatted(spaceSegment));
        }
        return spaceSegment;
    }
}
