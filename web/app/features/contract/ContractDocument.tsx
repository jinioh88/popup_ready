import { Card } from "../../components/ui/Card";
import type { Contract } from "../../lib/schemas/contract";
/**
 * 계약 조항 전문 렌더.
 *
 * **조항 문구는 서버가 치환을 끝내서 보낸다 — 웹은 가공하지 않는다.** 요약·발췌·말줄임도 하지
 * 않는다. 사용자가 서명하는 대상은 화면에 보이는 그 문서이고, 화면과 저장본이 다르면
 * `contentHash`로 무결성을 주장할 근거가 사라진다.
 */
export function ContractDocument({ contract }: { contract: Contract }) {
  return (
    <Card as="article" padding="lg">
      <header className="border-b border-border pb-4">
        <h2 className="text-title">{contract.title}</h2>
        <p className="mt-1 text-caption text-text-muted">
          템플릿 {contract.templateVersion} · 예약 요청 #{contract.reservationRequestId}
        </p>
      </header>

      <ol className="mt-6 flex flex-col gap-6">
        {contract.clauses.map((clause, index) => (
          <li key={`${index}-${clause.title}`}>
            <h3 className="text-body-strong">{clause.title}</h3>
            {/* 전문은 한 문단으로 온다. 줄바꿈이 섞여 와도 원문 그대로 보이게 둔다. */}
            <p className="mt-2 whitespace-pre-line text-body text-text">{clause.body}</p>
          </li>
        ))}
      </ol>

      <footer className="mt-6 border-t border-border pt-4">
        <p className="text-caption text-text-muted">
          무결성 해시(SHA-256)
          <br />
          <code className="break-all font-mono text-caption">{contract.contentHash}</code>
        </p>
      </footer>
    </Card>
  );
}
