package com.popupready.server.reservation;

/**
 * 레이아웃 재검증·견적 계산에 필요한 집기 규격만 추린 값.
 *
 * <p>집기 정보의 원장은 {@code fixture} 도메인이고 여기서는 그 서비스가 준 응답을 옮겨 담는다.
 * 그 도메인의 API DTO를 그대로 끌어오지 않는 이유는, 검증·견적이 <b>의존성 없는 순수 계산</b>으로
 * 남아야 하기 때문이다 — 응답 DTO를 받으면 순수 클래스가 남의 와이어 포맷에 묶인다.
 */
public record FixtureSpec(long fixtureId, int widthMm, int depthMm, int powerWatt, long dailyRentalFee, int stockQty) {}
