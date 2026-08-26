import { useParams } from "react-router";

import { Button } from "../components/ui/Button";
import { ContractDocument } from "../features/contract/ContractDocument";
import { SignaturePanel } from "../features/contract/SignaturePanel";
import { contractLoadMessage, signMessage } from "../features/contract/messages";
import { useContract, useSignContract } from "../features/contract/queries";
import { useReservation } from "../features/payment/queries";
import { getCurrentUser } from "../lib/api/token";

export function meta() {
  return [{ title: "계약 · PopupReady" }];
}

/**
 * 계약 열람·서명 화면 (US-202, F-2). 이 모듈은 화면 조립만 한다.
 *
 * 계약 명칭 '단기 공간사용 제휴계약'과 조항 문구는 **서버가 준 것을 그대로 쓴다** —
 * 상가건물 임대차보호법상 일시사용 임대차 요건이 걸려 있어 웹이 지어내거나 다듬지 않는다.
 */
export default function ContractRoute() {
  const { reservationId } = useParams();
  const numericId = Number(reservationId);

  const contractQuery = useContract(numericId);
  const sign = useSignContract(numericId);

  /**
   * 결제 링크를 누구에게 보여줄지 (§8.9).
   *
   * **계약만으로는 판단할 수 없다** — 계약은 "서명이 끝났는가"를 알지 "이 사람이 결제할
   * 사람인가"를 모른다. 그 답은 예약의 `brandUserId`에 있다.
   *
   * 화면 표시 판단일 뿐이고 **접근 통제가 아니다** — 서버가 `prepare`에서 403으로 막는다(§8.10).
   * 예약 조회는 결제 화면과 같은 쿼리 키를 쓰므로, 여기서 받아 두면 결제 화면이 따뜻하게 열린다.
   */
  const reservationQuery = useReservation(numericId);
  const currentUser = getCurrentUser();
  const brandUserId = reservationQuery.data?.brandUserId;

  // **`undefined`(모른다)와 `false`(아니다)를 구분한다.** 아직 못 받았거나 로그인 정보가 없는
  // 동안 "결제는 브랜드가 진행합니다"를 띄우면, 정작 그 브랜드에게 거짓말을 하게 된다.
  const isBrandParty =
    currentUser && brandUserId !== undefined ? currentUser.id === brandUserId : undefined;

  if (contractQuery.isPending) {
    return <StatusMessage>계약서를 불러오는 중…</StatusMessage>;
  }

  if (contractQuery.isError || !contractQuery.data) {
    // 재시도 수단을 반드시 남긴다 — 이 쿼리는 자동 재시도를 끄고 있어서(생성 POST를 품고 있다)
    // 버튼이 없으면 일시적 실패 한 번에 서명하러 온 사용자가 새로고침 말고는 길이 없다.
    return (
      <StatusMessage tone="error" onRetry={() => void contractQuery.refetch()}>
        {contractLoadMessage(contractQuery.error)}
      </StatusMessage>
    );
  }

  const contract = contractQuery.data;

  return (
    <main className="flex flex-col gap-4 px-6 py-6">
      <header>
        <h1 className="text-display">{contract.title}</h1>
        <p className="mt-2 text-caption text-text-muted">
          조항 전문을 확인하고 서명합니다. 서명 시각과 무결성 해시는 분쟁 시 소명 자료가 됩니다.
        </p>
      </header>

      <div className="flex items-start gap-6">
        <div className="min-w-0 flex-1">
          <ContractDocument contract={contract} />
        </div>
        <SignaturePanel
          contract={contract}
          reservationId={numericId}
          isBrandParty={isBrandParty}
          onSign={() => sign.mutate(contract.id)}
          isPending={sign.isPending}
          errorMessage={sign.isError ? signMessage(sign.error) : undefined}
        />
      </div>
    </main>
  );
}

function StatusMessage({
  children,
  tone,
  onRetry,
}: {
  children: React.ReactNode;
  tone?: "error";
  onRetry?: () => void;
}) {
  return (
    <main className="px-6 py-6">
      <p className={`text-body ${tone === "error" ? "text-error" : "text-text-muted"}`}>
        {children}
      </p>
      {onRetry ? (
        <Button onClick={onRetry} className="mt-4">
          다시 시도
        </Button>
      ) : null}
    </main>
  );
}
