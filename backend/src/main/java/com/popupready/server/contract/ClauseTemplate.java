package com.popupready.server.contract;

/**
 * 치환 전 조항 1개. {@code {{변수}}} 자리를 그대로 들고 있으며, {@link ClauseBinder}를 지나면
 * {@link ClauseDto}(전문 스냅샷)가 된다.
 */
public record ClauseTemplate(String title, String body) {}
