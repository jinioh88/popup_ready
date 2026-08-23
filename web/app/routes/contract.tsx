import { useParams } from "react-router";

import { ContractDocument } from "../features/contract/ContractDocument";
import { SignaturePanel } from "../features/contract/SignaturePanel";
import { contractLoadMessage, signMessage } from "../features/contract/messages";
import { useContract, useSignContract } from "../features/contract/queries";

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
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 h-10 rounded-lg bg-primary px-4 text-body-strong text-white hover:bg-primary-dark"
        >
          다시 시도
        </button>
      ) : null}
    </main>
  );
}
