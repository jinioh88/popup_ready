import { z } from "zod";

/**
 * 계약 응답 런타임 파싱 (US-202).
 *
 * **핵심 응답 3종 규약의 PM 승인 예외다(2026-08-23, 4종째).** 계약은 일시사용 임대차 요건을
 * 지탱하는 법률 세이프가드의 실체이고, 조항이 누락되거나 훼손된 응답이 **조용히 렌더되면
 * 사용자가 실제와 다른 문서에 서명**하게 된다. 생성 타입은 컴파일 타임 보증만 주므로
 * 이 경계에서 런타임으로 한 번 더 막는다.
 *
 * 조항 전문은 **서버가 치환을 끝내서 보낸다** — 웹은 변수를 채우지 않고 그대로 렌더한다.
 */

/**
 * UTC ISO-8601 타임스탬프 (sprint1.md §2.2 표기 규약). 미서명이면 null이다.
 *
 * `offset: true`로 둔 건 방어적 선택이다 — 규약은 `Z` 표기지만, 오프셋 표기(`+09:00`)가
 * 한 번 섞여 오면 **계약 화면 전체가 파싱 실패로 잠긴다.** 이 스키마가 막아야 할 것은
 * 조항 훼손이지 같은 시각의 다른 표기가 아니다.
 */
const signedAt = z.string().datetime({ offset: true }).nullable();

export const CONTRACT_STATUSES = ["PENDING", "SIGNED"] as const;
export type ContractStatus = (typeof CONTRACT_STATUSES)[number];

/**
 * 계약 조항. `title`은 "제N조 (…)", `body`는 치환 완료된 전문이다.
 *
 * 둘 다 **비어 있으면 안 된다** — 빈 조항이 렌더되면 사용자에게는 '내용 없는 계약서'가 보이는데,
 * 그건 화면 버그가 아니라 계약 문서의 훼손이다.
 */
export const clauseSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
});

export const contractSchema = z.object({
  id: z.number().int(),
  reservationRequestId: z.number().int(),
  /** '단기 공간사용 제휴계약' — 법률 세이프가드라 웹이 임의로 바꾸지 않는다. */
  title: z.string().min(1),
  templateVersion: z.string().min(1),
  /** v1 기준 7개 조항. 개수를 박아두지는 않되 **빈 배열은 거부**한다. */
  clauses: z.array(clauseSchema).min(1, "조항이 없는 계약서는 표시하지 않습니다."),
  /** 조항 전문 + 타임스탬프의 SHA-256. 소명 자료의 무결성 근거다. */
  contentHash: z.string().min(1),
  brandSignedAt: signedAt,
  landlordSignedAt: signedAt,
  status: z.enum(CONTRACT_STATUSES),
});

export type Clause = z.infer<typeof clauseSchema>;
export type Contract = z.infer<typeof contractSchema>;
