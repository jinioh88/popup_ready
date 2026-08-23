package com.popupready.server.door;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 발행·구독 토픽 조립(§2.3). <b>토픽을 만드는 곳은 여기 하나다</b> — 클라이언트는 서버가 내려준
 * 문자열을 그대로 쓰고 조립하지 않는다.
 */
class DoorTopicsTest {

    @Test
    @DisplayName("공간 식별자로 발행·구독 토픽을 만든다")
    void topics_areBuiltFromSpaceId() {
        assertThat(DoorTopics.command("1")).isEqualTo("popupready/locks/1/command");
        assertThat(DoorTopics.status("1")).isEqualTo("popupready/locks/1/status");
    }

    @Test
    @DisplayName("🚨 와일드카드가 섞인 식별자 → 조립을 거절한다")
    void wildcardSegment_isRejected() {
        // '+'는 발행에서 "여러 도어락에 한 번에"가 되고, 구독에서는 더 나쁘다 —
        // 조용히 성공하면서 남의 공간 상태를 받아온다. 거절되는 것보다 나쁜 실패다.
        //
        // 지금은 spaceId가 Long이라 타입이 이걸 막고 있지만, 그건 우리가 정한 방어가 아니라
        // 우연한 타입 선택이다. 식별자가 slug나 외부 ID로 바뀌는 순간 아무 경고 없이 뚫린다.
        assertThatThrownBy(() -> DoorTopics.command("+")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> DoorTopics.status("#")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> DoorTopics.command("1/+")).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("빈 식별자 → 거절한다")
    void blankSegment_isRejected() {
        assertThatThrownBy(() -> DoorTopics.command("")).isInstanceOf(IllegalArgumentException.class);
    }
}
