/**
 * 디자인 토큰 — `docs/스타일가이드.md`(v0.1) §5.2 매핑.
 *
 * 화면 코드는 인라인 HEX·매직 넘버 간격 대신 반드시 이 모듈을 import한다.
 * 여기 없는 토큰을 임의로 추가하거나 값을 바꾸는 것은 PM 협의 사항이다.
 * React·Expo 무의존 순수 모듈(src/lib/ 규칙).
 */

export const colors = {
  primary: "#4F46E5",
  primaryDark: "#4338CA",
  primaryLight: "#EEF2FF",
  accent: "#F97316",
  success: "#16A34A",
  warning: "#F59E0B",
  error: "#DC2626",
  info: "#0284C7",
  text: "#0F172A",
  textMuted: "#475569",
  border: "#E2E8F0",
  bg: "#F8FAFC",
  surface: "#FFFFFF",
} as const;

/** 4px 배수만 사용한다(가이드 §3). */
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;

/** 이 세 값 외의 반경은 쓰지 않는다(가이드 §3). */
export const radius = { input: 8, card: 12, pill: 9999 } as const;

/** 6단계 외 크기 금지, 굵기는 400/600/700만(가이드 §2). */
export const typography = {
  display: { fontSize: 28, lineHeight: 36, fontWeight: "700" },
  title: { fontSize: 22, lineHeight: 30, fontWeight: "700" },
  heading: { fontSize: 18, lineHeight: 26, fontWeight: "600" },
  body: { fontSize: 16, lineHeight: 24, fontWeight: "400" },
  bodyStrong: { fontSize: 16, lineHeight: 24, fontWeight: "600" },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: "400" },
} as const;
