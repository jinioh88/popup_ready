package com.popupready.server.door;

import io.swagger.v3.oas.annotations.media.Schema;

/** 도어 오픈 이벤트의 상태(스프린트 문서 §2.1). */
@Schema(description = "도어 오픈 이벤트 상태")
public enum DoorEventStatus {

    /**
     * 서버가 권한·시간창을 확인하고 발행을 허가했다. <b>승인 기록일 뿐 발행 기록은 아니다</b> —
     * 실제 MQTT 발행 결과는 ack가 와야 확정된다.
     */
    AUTHORIZED,
    /** 모바일이 MQTT 발행에 성공했다고 보고했다 */
    DELIVERED,
    /** 모바일이 발행 실패를 보고했다. publish 실패를 성공으로 위장하지 않기 위한 상태다 */
    FAILED
}
