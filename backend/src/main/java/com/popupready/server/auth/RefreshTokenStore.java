package com.popupready.server.auth;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.Set;
import java.util.function.Supplier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.scripting.support.ResourceScriptSource;
import org.springframework.stereotype.Component;

/**
 * Refresh 토큰의 저장·회전·유출 감지(T1-1).
 *
 * <p><b>토큰은 불투명 난수다.</b> JWT로 만들지 않은 이유는 셋이다 — ① 폐기가 저장소 하나로
 * 확정된다("서명은 유효한데 폐기됨"이라는 애매한 상태가 없다), ② Access 토큰과 형태가 달라
 * 실수로 바꿔 쓸 수 없다, ③ 어차피 회전·감지 때문에 매번 저장소를 읽어야 해서 자기서술의
 * 이득이 없다.
 *
 * <p><b>저장소는 Redis다.</b> Refresh 토큰은 TTL이 본질인 데이터라 RDB보다 맞고, 엔티티가
 * 하나 늘지 않는다. 대가는 Redis를 비우면 전원 로그아웃된다는 것이며 개발 단계에서는 수용한다.
 *
 * <h2>패밀리와 폐기 범위</h2>
 *
 * 로그인 한 번이 <b>패밀리</b> 하나를 만들고, 회전은 그 안에서 이어진다. 재사용이 감지되면
 * <b>그 패밀리만</b> 끊는다 — 사용자 단위로 끊으면 휴대폰의 오탐 하나로 데스크톱 세션까지
 * 함께 죽는다.
 *
 * <h2>유예 창 (grace)</h2>
 *
 * 회전 직후 옛 토큰을 곧바로 무효로 만들면, <b>동시 요청이 함께 만료를 맞은 정상 클라이언트가
 * 경합만으로 세션을 잃는다</b>(모바일 제기, 2026-08-23). 첫 요청이 회전에 성공하는 순간 나머지가
 * 든 토큰은 옛 것이 되기 때문이다. 그래서 회전된 토큰을 짧은 창 동안 <b>후속 토큰을 가리키는
 * 이정표</b>로 남겨 두고, 그 안에 다시 오면 폐기 대신 같은 후속 토큰을 돌려준다.
 *
 * <p>감지를 포기한 것이 아니다 — 창을 넘겨 돌아온 옛 토큰은 여전히 유출 신호로 보고 패밀리를
 * 끊는다. 도둑이 훔친 토큰을 몇 초 안에 쓰는 경우만 놓치며, 그 대가로 정상 사용자가 경합으로
 * 로그아웃되는 흔한 오탐을 없앤다.
 *
 * <h2>원자성</h2>
 *
 * 회전은 <b>Lua 스크립트 한 번</b>으로 일어난다. Java에서 읽고-판정하고-쓰면 동시 요청이 모두
 * {@code ACTIVE}를 읽은 뒤 각자 회전해 한 패밀리에 살아 있는 토큰이 여럿 생긴다. 그러면 이정표는
 * 그중 하나만 가리키고, <b>도둑과 정상 사용자가 나란히 회전해도 아무도 걸리지 않아 감지가
 * 무의미해진다.</b> 실서버 동시 요청 2건이 서로 다른 후속 토큰을 받는 것으로 실제 확인됐다.
 *
 * <p>유예 판정은 Lua가 아니라 여기서 한다 — 시각 비교까지 스크립트에 넣으면 테스트가 시계를 밀어
 * 두 경로를 재현할 수 없다.
 *
 * <p><b>이정표는 유예가 아니라 원래 유효기간만큼 남긴다.</b> 유예가 지났다고 지워버리면 되돌아온
 * 옛 토큰이 "재사용"이 아니라 "알 수 없는 토큰"으로 보여 <b>감지 자체가 사라진다</b> — 그러면
 * 도둑이 든 토큰만 조용히 거절되고 패밀리는 살아남는다. 유예 판정은 삭제가 아니라 이정표에
 * 적어 둔 회전 시각으로 한다.
 */
@Component
public class RefreshTokenStore {

    private static final String TOKEN_KEY = "popupready:refresh:token:";

    private static final String FAMILY_KEY = "popupready:refresh:family:";

    /** 회전되지 않은, 지금 쓸 수 있는 토큰. */
    private static final String ACTIVE = "ACTIVE";

    /** 이미 회전된 토큰. 뒤에 후속 토큰이 붙는다. */
    private static final String ROTATED_PREFIX = "ROTATED:";

    private static final SecureRandom RANDOM = new SecureRandom();

    /** 저장소에 그 토큰이 없다는 Lua의 응답. */
    private static final String MISSING = "MISSING";

    private static final RedisScript<String> ROTATE_SCRIPT = rotateScript();

    private static RedisScript<String> rotateScript() {
        DefaultRedisScript<String> script = new DefaultRedisScript<>();
        script.setScriptSource(new ResourceScriptSource(new ClassPathResource("redis/rotate-refresh-token.lua")));
        script.setResultType(String.class);
        return script;
    }

    private final StringRedisTemplate redis;

    private final Duration validity;

    private final Duration grace;

    private final Supplier<Instant> clock;

    /** {@link #candidate()}가 만든 값을 스크립트 인자로 넘기기 위한 자리. 호출 스레드에만 보인다. */
    private final ThreadLocal<String> candidateHolder = ThreadLocal.withInitial(() -> null);

    public RefreshTokenStore(
            StringRedisTemplate redis,
            @Value("${popupready.jwt.refresh-validity}") Duration validity,
            @Value("${popupready.jwt.refresh-grace}") Duration grace,
            Supplier<Instant> clock) {
        this.redis = redis;
        this.validity = validity;
        this.grace = grace;
        this.clock = clock;
    }

    /** 회전 결과. 거절은 null로 알린다 — 사유를 구분해 알려주지 않는 것이 이 계층의 규약이다. */
    public record Rotation(long userId, String refreshToken) {}

    /** 로그인 성공 시 새 패밀리를 연다. */
    public String issue(long userId) {
        return issueInto(userId, randomToken());
    }

    /**
     * 토큰을 회전한다. 알 수 없거나 재사용으로 판정되면 {@code null}을 돌려주고, 재사용이면
     * 그 패밀리를 통째로 끊는다.
     */
    public Rotation rotate(String refreshToken) {
        // familyId는 토큰마다 불변이라 스크립트 밖에서 읽어도 경합이 없다. 그 사이 항목이 사라지면
        // 스크립트가 MISSING을 돌려주므로 판정은 어차피 원자적 경로 안에서 끝난다.
        String current = redis.opsForValue().get(TOKEN_KEY + refreshToken);
        if (current == null) {
            return null;
        }
        String familyId = Entry.parse(current).familyId();

        // 난수는 Java가 만들고 쓸지 말지는 Lua가 정한다 — 경합에서 진 요청의 후보는 그냥 버려진다.
        String candidate = randomToken();
        String raw = redis.execute(
                ROTATE_SCRIPT,
                List.of(TOKEN_KEY + refreshToken, TOKEN_KEY + candidate, FAMILY_KEY + familyId),
                candidate,
                String.valueOf(clock.get().toEpochMilli()),
                String.valueOf(validity.toMillis()));

        if (raw == null || MISSING.equals(raw)) {
            return null;
        }
        Entry entry = Entry.parse(raw);
        if (!isWithinGrace(entry)) {
            // 유예를 넘겨 되돌아온 옛 토큰이다. 도둑과 정상 사용자 중 누가 들고 왔는지 알 수 없으므로
            // 세션 전체를 끊는다 — 후속 토큰만 살려두면 도둑이 계속 회전할 수 있다.
            return revoke(entry);
        }
        // 방금 회전했든, 경합으로 늦게 도착해 남의 회전 결과를 받았든 같은 후속 토큰을 돌려준다.
        String successor = entry.successor();
        return redis.hasKey(TOKEN_KEY + successor) ? new Rotation(entry.userId(), successor) : revoke(entry);
    }

    /** 로그아웃 등으로 세션 하나를 끝낸다. */
    public void revokeFamilyOf(String refreshToken) {
        String raw = redis.opsForValue().get(TOKEN_KEY + refreshToken);
        if (raw != null) {
            revoke(Entry.parse(raw));
        }
    }

    private Rotation revoke(Entry entry) {
        Set<String> members = redis.opsForSet().members(FAMILY_KEY + entry.familyId());
        if (members != null) {
            members.forEach(token -> redis.delete(TOKEN_KEY + token));
        }
        redis.delete(FAMILY_KEY + entry.familyId());
        return null;
    }

    /** 새 패밀리를 여는 최초 발급. 이후의 회전은 Lua 스크립트가 저장까지 맡는다. */
    private String issueInto(long userId, String token) {
        String familyId = randomToken();
        redis.opsForValue().set(TOKEN_KEY + token, new Entry(userId, familyId, ACTIVE).serialize(), validity);
        redis.opsForSet().add(FAMILY_KEY + familyId, token);
        redis.expire(FAMILY_KEY + familyId, validity);
        return token;
    }

    private boolean isWithinGrace(Entry entry) {
        Duration elapsed = Duration.between(Instant.ofEpochMilli(entry.rotatedAtMillis()), clock.get());
        return elapsed.compareTo(grace) <= 0;
    }

    private static String randomToken() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    /**
     * 저장 값. {@code userId|familyId|상태} 형태이며 상태는 {@code ACTIVE} 또는
     * {@code ROTATED:{후속 토큰}}이다. 후속 토큰은 Base64URL이라 구분자 {@code |}가 섞이지 않는다.
     */
    private record Entry(long userId, String familyId, String state) {

        static Entry parse(String raw) {
            String[] parts = raw.split("\\|", 3);
            return new Entry(Long.parseLong(parts[0]), parts[1], parts[2]);
        }

        String serialize() {
            return userId + "|" + familyId + "|" + state;
        }

        boolean isRotated() {
            return state.startsWith(ROTATED_PREFIX);
        }

        /** {@code ROTATED:{후속 토큰}:{회전 시각}} — 후속 토큰은 Base64URL이라 {@code :}가 섞이지 않는다. */
        private String[] rotatedParts() {
            return state.substring(ROTATED_PREFIX.length()).split(":", 2);
        }

        String successor() {
            return rotatedParts()[0];
        }

        long rotatedAtMillis() {
            return Long.parseLong(rotatedParts()[1]);
        }
    }
}
