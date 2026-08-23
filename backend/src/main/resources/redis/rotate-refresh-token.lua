-- Refresh 토큰 회전을 원자적으로 수행한다(T1-1).
--
-- Java에서 GET → 판정 → SET으로 나눠 하면 동시 요청이 모두 ACTIVE를 읽은 뒤 각자 회전해
-- 한 패밀리에 살아 있는 토큰이 여럿 생긴다. 그러면 이정표는 그중 하나만 가리키고, 도둑과
-- 정상 사용자가 나란히 회전해도 아무도 걸리지 않아 재사용 감지가 무의미해진다.
-- 실서버 동시 요청 2건이 서로 다른 후속 토큰을 받는 것으로 실제 확인됐다.
--
-- KEYS[1] 회전할 토큰 키   KEYS[2] 후속 토큰 키   KEYS[3] 패밀리 SET 키
-- ARGV[1] 후속 토큰(난수는 Java가 만든다)   ARGV[2] 현재 시각(ms)   ARGV[3] 유효기간(ms)
--
-- 반환: 'MISSING' 또는 저장된 값(userId|familyId|상태). 유예 판정은 호출자가 한다 —
--       Lua에 시각 비교까지 넣으면 테스트가 시계를 밀어 두 경로를 재현할 수 없다.

local raw = redis.call('GET', KEYS[1])
if not raw then
  return 'MISSING'
end

local first = string.find(raw, '|', 1, true)
local second = string.find(raw, '|', first + 1, true)
local userId = string.sub(raw, 1, first - 1)
local familyId = string.sub(raw, first + 1, second - 1)
local state = string.sub(raw, second + 1)

-- 이미 회전된 토큰이면 그대로 돌려준다. 두 번 회전시키지 않는 것이 이 스크립트의 요점이다.
if string.sub(state, 1, 8) == 'ROTATED:' then
  return raw
end

local validity = tonumber(ARGV[3])
local rotated = userId .. '|' .. familyId .. '|ROTATED:' .. ARGV[1] .. ':' .. ARGV[2]
redis.call('SET', KEYS[1], rotated, 'PX', validity)
redis.call('SET', KEYS[2], userId .. '|' .. familyId .. '|ACTIVE', 'PX', validity)
redis.call('SADD', KEYS[3], ARGV[1])
redis.call('PEXPIRE', KEYS[3], validity)
return rotated
