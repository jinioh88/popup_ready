package com.popupready.server.auth;

/** 검증된 토큰에서 꺼낸 신원. 여기 담긴 값은 서명으로 무결성이 보장된 것만이다. */
public record JwtPrincipal(Long userId, UserRole role) {}
