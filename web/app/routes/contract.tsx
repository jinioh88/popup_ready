import { useParams } from "react-router";

export function meta() {
  return [{ title: "계약 · PopupReady" }];
}

/**
 * 계약 열람·서명 화면(최소). 조항 전문·서명 배선은 F-2에서 채운다.
 * 계약 명칭 '단기 공간사용 제휴계약'은 법률 세이프가드이므로 임의로 바꾸지 않는다.
 */
export default function ContractRoute() {
  const { reservationId } = useParams();

  return (
    <main className="px-6 py-6">
      <h1 className="text-display">단기 공간사용 제휴계약</h1>
      <p className="mt-2 text-body text-text-muted">
        예약 요청 #{reservationId}의 계약서를 확인하고 서명합니다. (US-202 연계 — Phase F)
      </p>
    </main>
  );
}
