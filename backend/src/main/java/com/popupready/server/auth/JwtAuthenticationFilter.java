package com.popupready.server.auth;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Authorization 헤더의 Bearer 토큰을 검증해 SecurityContext에 신원을 채운다.
 *
 * <p><b>토큰이 없거나 신뢰할 수 없으면 인증하지 않고 그대로 통과시킨다.</b> 여기서 401을 쓰지 않는
 * 이유는 공개 경로도 이 필터를 지나가기 때문이다. 보호가 필요한 경로에서 인증이 비어 있으면
 * {@link com.popupready.server.common.ApiAuthenticationEntryPoint}가 401을 돌려준다.
 */
@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private static final String BEARER_PREFIX = "Bearer ";

    private final JwtProvider jwtProvider;

    public JwtAuthenticationFilter(JwtProvider jwtProvider) {
        this.jwtProvider = jwtProvider;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        resolveToken(request).ifPresent(token -> authenticate(token, request));
        chain.doFilter(request, response);
    }

    private java.util.Optional<String> resolveToken(HttpServletRequest request) {
        String header = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (header == null || !header.startsWith(BEARER_PREFIX)) {
            return java.util.Optional.empty();
        }
        return java.util.Optional.of(header.substring(BEARER_PREFIX.length()));
    }

    private void authenticate(String token, HttpServletRequest request) {
        try {
            JwtPrincipal principal = jwtProvider.parse(token);
            var authority =
                    new SimpleGrantedAuthority("ROLE_" + principal.role().name());
            var authentication = new UsernamePasswordAuthenticationToken(principal, null, List.of(authority));
            SecurityContextHolder.getContext().setAuthentication(authentication);
        } catch (InvalidTokenException e) {
            // 신뢰할 수 없는 토큰은 없는 것으로 취급한다. 사유를 응답에 흘리지 않기 위해
            // 여기서 예외를 밖으로 던지지 않으며, 컨텍스트는 비운 채로 둔다.
            SecurityContextHolder.clearContext();
        }
    }
}
