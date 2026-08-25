import { Link } from "react-router";

import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { formatSignedAt } from "../../lib/datetime";
import type { Contract } from "../../lib/schemas/contract";

/**
 * 서명 현황 + 서명 버튼.
 *
 * **어느 쪽이 내 서명인지 웹은 모른다** — 토큰만 보관하고 로그인 사용자 정보를 들고 있지 않기
 * 때문이다(Sprint 2 개선 후보). 그래서 양측 상태를 그대로 보여주고, 서명 가능 여부의 판단은
 * 서버에 맡긴다(당사자가 아니면 `NOT_CONTRACT_PARTY`, 이미 했으면 `CONTRACT_ALREADY_SIGNED`).
 *
 * 신뢰 흐름이라 `primary` 단색만 쓰고 `accent`는 쓰지 않는다(스타일가이드 §4).
 */

type SignaturePanelProps = {
  contract: Contract;
  /** 결제 화면으로 넘어갈 때 쓰는 예약 id. 계약 id와 다르다. */
  reservationId: number;
  /**
   * 이 사람이 **결제할 당사자(브랜드)인가.** `undefined`는 "아직 모른다"이며
   * **"아니다"와 다르게 다뤄야 한다** — 모르는 동안 단정적인 안내를 띄우면 그게 거짓말이 된다.
   *
   * 판정은 라우트가 한다(§8.5와 같은 이유). 이 패널은 계약만 알고 예약의 당사자를 모른다.
   */
  isBrandParty?: boolean;
  onSign: () => void;
  isPending?: boolean;
  errorMessage?: string;
};

export function SignaturePanel({
  contract,
  reservationId,
  isBrandParty,
  onSign,
  isPending,
  errorMessage,
}: SignaturePanelProps) {
  const isSigned = contract.status === "SIGNED";

  return (
    <Card as="aside" className="flex w-80 shrink-0 flex-col gap-4">
      <h2 className="text-heading">서명 현황</h2>

      <dl className="flex flex-col gap-3">
        <SignatureRow label="브랜드" signedAt={contract.brandSignedAt} />
        <SignatureRow label="건물주" signedAt={contract.landlordSignedAt} />
      </dl>

      {isSigned ? (
        <>
          <p className="rounded-lg bg-bg p-3 text-caption text-text-muted">
            양 당사자의 서명이 완료된 계약입니다.
          </p>
          {/*
            **서명이 끝나면 다음 걸음은 결제다.** 이 링크가 없으면 사용자는 결제 화면으로 갈
            방법이 없다 — 라우트는 있었지만 어디서도 가리키지 않아 URL을 직접 쳐야 했다.
            서버도 이 시점(CONTRACT_SIGNED)부터 결제를 받는다.

            **다만 서명이 끝난 시점인가와 이 사람이 결제할 사람인가는 다른 질문이다.**
            처음엔 앞엣것만 물어서 건물주에게도 버튼이 보였고, 사용자는 이상하다고 느끼면서도
            눌렀다 — 화면이 권했기 때문이다(§8.9). 없던 문을 만들 때 자물쇠를 같이 달지 않았다.
          */}
          {isBrandParty === true ? (
            <Button as={Link} to={`/reservations/${reservationId}/payment`}>
              결제하기
            </Button>
          ) : null}

          {/*
            **비활성 버튼을 두지 않는다.** 누를 수 없는 버튼은 "왜 안 되지"를 사용자에게 떠넘긴다.
            건물주에게 필요한 것은 막힌 버튼이 아니라 **다음에 무슨 일이 일어나는지**다.
          */}
          {isBrandParty === false ? (
            <p className="text-caption text-text-muted">
              결제는 예약을 만든 브랜드가 진행합니다. 결제가 끝나면 예약이 확정됩니다.
            </p>
          ) : null}
        </>
      ) : (
        <>
          <p className="text-caption text-text-muted">
            조항 전문을 확인한 뒤 서명해 주세요. 서명은 당사자별 1회이며 되돌릴 수 없습니다.
          </p>
          <Button onClick={onSign} disabled={isPending}>
            {isPending ? "서명 중…" : "동의하고 서명하기"}
          </Button>
        </>
      )}

      {errorMessage ? (
        <p role="alert" className="text-caption text-error">
          {errorMessage}
        </p>
      ) : null}
    </Card>
  );
}

function SignatureRow({ label, signedAt }: { label: string; signedAt: string | null }) {
  const formatted = formatSignedAt(signedAt);

  return (
    <div className="flex flex-col gap-1">
      <dt className="text-caption text-text-muted">{label}</dt>
      <dd className={formatted ? "text-body" : "text-body text-text-muted"}>
        {formatted ?? "서명 대기"}
      </dd>
    </div>
  );
}
