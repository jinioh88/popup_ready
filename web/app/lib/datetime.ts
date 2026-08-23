/**
 * 표시용 시각 변환.
 *
 * 서버가 주는 타임스탬프는 **UTC ISO-8601**이고 표시 변환은 클라이언트 몫이다
 * (sprint1.md §2.2 표기 규약). 계약 서명 시각은 분쟁 시 소명 자료로 읽히므로
 * **어느 시간대로 읽은 값인지 화면에 남긴다** — "2026-08-22 14:12" 만 있으면 KST인지 UTC인지 모른다.
 */

const KST_OFFSET_MINUTES = 9 * 60;

/** UTC ISO-8601 → `2026-08-22 14:12 (KST)`. 값이 없거나 해석 불가면 undefined. */
export function formatSignedAt(iso: string | null | undefined): string | undefined {
  if (!iso) {
    return undefined;
  }

  const parsed = Date.parse(iso);

  if (Number.isNaN(parsed)) {
    return undefined;
  }

  // 사용자 로컬 타임존에 따라 값이 달라지면 소명 자료로 쓸 수 없다 — KST로 고정해 표기한다.
  const kst = new Date(parsed + KST_OFFSET_MINUTES * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    `${kst.getUTCFullYear()}-${pad(kst.getUTCMonth() + 1)}-${pad(kst.getUTCDate())} ` +
    `${pad(kst.getUTCHours())}:${pad(kst.getUTCMinutes())} (KST)`
  );
}
