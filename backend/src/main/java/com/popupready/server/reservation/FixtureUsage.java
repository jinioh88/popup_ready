package com.popupready.server.reservation;

/**
 * 집기별 점유 수량 집계 결과(T1-2). Spring Data의 인터페이스 프로젝션이라 네이티브 쿼리의
 * 컬럼 별칭({@code fixture_id}·{@code reserved_qty})이 게터에 그대로 매핑된다.
 */
public interface FixtureUsage {

    Long getFixtureId();

    Integer getReservedQty();
}
