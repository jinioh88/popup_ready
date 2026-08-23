package com.popupready.server.common;

import org.springframework.http.HttpStatus;

/**
 * 웹/모바일과 공유하는 에러 코드 목록. 클라이언트는 이 이름으로 분기하므로
 * 상수 이름 변경은 API 계약 변경이다 — 스프린트 문서 갱신 + PM 보고가 함께 가야 한다.
 */
public enum ErrorCode {

    // 공통
    VALIDATION_FAILED(HttpStatus.BAD_REQUEST),
    UNAUTHORIZED(HttpStatus.UNAUTHORIZED),
    FORBIDDEN(HttpStatus.FORBIDDEN),
    NOT_FOUND(HttpStatus.NOT_FOUND),
    METHOD_NOT_ALLOWED(HttpStatus.METHOD_NOT_ALLOWED),
    UNSUPPORTED_MEDIA_TYPE(HttpStatus.UNSUPPORTED_MEDIA_TYPE),
    INTERNAL_ERROR(HttpStatus.INTERNAL_SERVER_ERROR),

    // auth
    EMAIL_ALREADY_EXISTS(HttpStatus.CONFLICT),
    INVALID_CREDENTIALS(HttpStatus.UNAUTHORIZED),

    // space / fixture
    SPACE_NOT_FOUND(HttpStatus.NOT_FOUND),
    FIXTURE_NOT_FOUND(HttpStatus.NOT_FOUND),

    // reservation
    RESERVATION_REQUEST_NOT_FOUND(HttpStatus.NOT_FOUND),
    LAYOUT_OUT_OF_BOUNDS(HttpStatus.BAD_REQUEST),
    LAYOUT_OVERLAP(HttpStatus.BAD_REQUEST),
    // 총 보유량 초과 — "애초에 그만큼 없다". 시간이 지나도 해소되지 않는다.
    FIXTURE_STOCK_EXCEEDED(HttpStatus.BAD_REQUEST),
    // 그 날짜에 이미 다른 PAID 예약이 잡아갔다 — "지금은 없다". 위와 달리 기간을 옮기면 해소된다.
    // 웹이 두 상황에 다른 안내를 해야 하므로 코드를 가른다(Sprint 2 §2.2).
    FIXTURE_UNAVAILABLE(HttpStatus.CONFLICT),
    // 같은 공간·겹치는 기간에 이미 결제된 예약이 있다. 집기 부족과 코드를 나누는 이유는
    // 사용자가 할 일이 다르기 때문이다 — 이쪽은 기간을 옮겨야 하고, 집기 부족은 배치를 줄여도 된다.
    // 같은 코드로 뭉개면 "집기를 빼보세요"라는 안내가 나가는데 그래도 해소되지 않는다.
    SPACE_ALREADY_BOOKED(HttpStatus.CONFLICT),
    // 하드 게이트는 전력 하나다. 면적 한도(AREA_LIMIT_EXCEEDED)는 §2.2-F로 철회됐다 —
    // 그리드 전체 면적이 floorAreaM2보다 작아 그리드 경계 판정을 통과한 배치는 넘을 수 없다.
    POWER_LIMIT_EXCEEDED(HttpStatus.BAD_REQUEST),

    // contract
    CONTRACT_NOT_FOUND(HttpStatus.NOT_FOUND),
    NOT_CONTRACT_PARTY(HttpStatus.FORBIDDEN),
    // 예약 하나에 계약은 하나다. 생성을 멱등으로 만들지 않고 이 코드를 내는 이유는, 조용히 기존
    // 계약을 돌려주면 더블 서브밋 버그가 정상 동작으로 위장되기 때문이다. 웹은 이 코드를 보면
    // GET /reservation-requests/{id}/contract로 넘어간다.
    CONTRACT_ALREADY_EXISTS(HttpStatus.CONFLICT),
    CONTRACT_ALREADY_SIGNED(HttpStatus.CONFLICT),
    // 서명된 계약의 조항이 저장된 해시와 맞지 않는다(결제 승인 경로 2-0에서 확인).
    // INTERNAL_ERROR로 뭉개지 않는 이유는 웹이 그것을 서버 장애로 읽고 재시도를 유도하기
    // 때문이다 — 재시도로 낫는 상황이 아니다. ⚠️ 이 해시는 체크섬이지 서명이 아니므로
    // 실제로 잡는 것은 "DB를 직접 고치면서 해시 재계산을 잊은 경우"뿐이다.
    CONTRACT_INTEGRITY_VIOLATION(HttpStatus.CONFLICT),

    // auth — refresh 토큰(Sprint 2)
    // 만료·위조·재사용을 구분해 알려주지 않는다. 사유가 구분되면 공격자에게 단서가 된다.
    REFRESH_TOKEN_INVALID(HttpStatus.UNAUTHORIZED),

    // payment (US-201)
    PAYMENT_ALREADY_COMPLETED(HttpStatus.CONFLICT),
    // 이미 처리된 주문으로 다시 승인을 시도했다. 재시도는 prepare부터 새 orderId로 해야 한다.
    // 500으로 알리면 클라이언트가 서버 장애로 읽고 같은 주문을 계속 재시도한다.
    ORDER_ID_ALREADY_USED(HttpStatus.CONFLICT),
    // PG 호출이 타임아웃돼 승인 여부를 모른다. 사용자 잘못이 아니고 재시도로 낫지도 않으므로
    // 실패(4xx)가 아니라 503으로 알린다 — 수동 확인이 필요한 상태다.
    PAYMENT_RESULT_UNKNOWN(HttpStatus.SERVICE_UNAVAILABLE),
    // PG가 거절했다. 카드사 사유는 rawResponse에 남고 클라이언트는 재시도를 안내한다.
    PAYMENT_DECLINED(HttpStatus.PAYMENT_REQUIRED),
    // 클라이언트가 보낸 금액이 견적 스냅샷과 다르다. 프론트 신뢰를 끊는 지점이다 —
    // 보낸 금액을 그대로 승인하지 않고 대조 대상으로만 쓴다(§2.2-C 2-5).
    PAYMENT_AMOUNT_MISMATCH(HttpStatus.BAD_REQUEST),
    // 재시도 3회를 소진하고도 락을 잡지 못했다. 사용자 잘못이 아니므로 웹은 재시도를 안내한다.
    LOCK_ACQUISITION_FAILED(HttpStatus.SERVICE_UNAVAILABLE),

    // door (US-301)
    // 시간창 밖이다. 판정 권위는 서버이며 클라이언트 시계를 보지 않는다(§2.3).
    //
    // ⚠️ 미결제와 코드를 공유하지 않는다. 둘을 같은 코드로 내보내면 클라이언트가 "조금만 기다리면
    //    열린다"고 안내하는데, 미결제는 기다려도 열리지 않아 화면이 거짓을 말한다. 사유가 갈리면
    //    문구도 갈릴 수 있다 — 게이트가 서버라는 규칙은 판정뿐 아니라 사유에도 적용된다.
    DOOR_NOT_YET_OPENABLE(HttpStatus.FORBIDDEN),
    // 결제되지 않은 예약이다. 시간이 지나도 해소되지 않으므로 위와 다른 코드여야 한다.
    RESERVATION_NOT_PAID(HttpStatus.FORBIDDEN),
    // 이미 마감된 도어 이벤트를 다시 ack했다. 더블 서브밋 같은 클라이언트 실수이므로 409다 —
    // 500으로 알리면 클라이언트가 서버 장애로 읽고 재시도하는데, 재시도로 낫는 상황이 아니다.
    DOOR_EVENT_ALREADY_ACKED(HttpStatus.CONFLICT);

    private final HttpStatus status;

    ErrorCode(HttpStatus status) {
        this.status = status;
    }

    public HttpStatus status() {
        return status;
    }
}
