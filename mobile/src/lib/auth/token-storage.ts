import * as SecureStore from "expo-secure-store";

/**
 * JWT 토큰 보관 키.
 *
 * SecureStore 키는 영숫자·마침표·하이픈·언더스코어만 허용한다(v54 문서). 슬래시·콜론 금지.
 */
const ACCESS_TOKEN_KEY = "popupready.accessToken";
const REFRESH_TOKEN_KEY = "popupready.refreshToken";

export type TokenPair = { accessToken: string; refreshToken: string };

/**
 * 토큰은 AsyncStorage가 아니라 expo-secure-store에 둔다(스코프 결정사항).
 *
 * 사용자 정보(user)는 여기 넣지 않는다 — 비밀이 아니고, iOS는 값이 커지면 저장을 거부한 전례가
 * 있어(문서상 ~2048바이트) 토큰만으로 여유를 남긴다. user는 서버 상태로 다룬다.
 *
 * 이 모듈은 판단 없이 감싸기만 한다(src/lib 어댑터 규칙).
 */
export async function saveAccessToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token);
}

export async function readAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
}

export async function readRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

/**
 * 두 토큰을 함께 쓴다.
 *
 * Refresh는 회전 방식이라 access만 갱신하고 refresh를 두면 다음 재발급에서 무효 토큰을
 * 보내게 된다. 갱신은 항상 쌍으로 한다.
 */
export async function saveTokens({ accessToken, refreshToken }: TokenPair): Promise<void> {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
}

export async function clearTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}
