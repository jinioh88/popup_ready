import * as SecureStore from "expo-secure-store";

/**
 * JWT Access 토큰 보관 키.
 *
 * SecureStore 키는 영숫자·마침표·하이픈·언더스코어만 허용한다(v54 문서). 슬래시·콜론 금지.
 */
const ACCESS_TOKEN_KEY = "popupready.accessToken";

/**
 * 토큰은 AsyncStorage가 아니라 expo-secure-store에 둔다(스코프 결정사항).
 *
 * 사용자 정보(user)는 여기 넣지 않는다 — 비밀이 아니고, iOS는 값이 커지면 저장을 거부한 전례가
 * 있어(문서상 ~2048바이트) 토큰만으로 여유를 남긴다. user는 서버 상태로 다룬다.
 */
export async function saveAccessToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token);
}

export async function readAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
}

export async function clearAccessToken(): Promise<void> {
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
}
