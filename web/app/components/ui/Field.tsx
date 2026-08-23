import { useId, type ReactNode } from "react";

/**
 * 라벨 + 컨트롤 + 에러/도움말 (디자인 시스템 기본 4종, sprint2-web.md T0-1).
 *
 * **컨트롤을 직접 렌더하지 않고 배선만 소유한다.** `input` 전용으로 만들면 `select`(공간 필터)와
 * `date`(예약 기간)가 각자 복제본을 만든다 — Sprint 1에서 실제로 그렇게 4곳으로 갈라졌다.
 * 컨트롤은 함수 children으로 받고, `id`·`aria-invalid`·`aria-describedby`·공통 시각 규격만
 * 여기서 한 번 정한다.
 *
 *   <Field label="이메일" error={errors.email?.message}>
 *     {(control) => <input type="email" {...control} {...register("email")} />}
 *   </Field>
 *
 * RHF `register()`는 `className`을 돌려주지 않으므로 뒤에 펼쳐도 시각 규격이 덮이지 않는다.
 */

/** `Field`가 컨트롤에 넘기는 배선. 화면 쪽에서 직접 만들지 않는다. */
export type FieldControlProps = {
  id: string;
  className: string;
  "aria-invalid": true | undefined;
  "aria-describedby": string | undefined;
};

type FieldProps = {
  label: string;
  /** 검증 실패 메시지. 있으면 테두리가 error 색으로 바뀌고 컨트롤과 `aria-describedby`로 연결된다. */
  error?: string;
  /** 항상 보이는 보조 설명. `error`와 함께 있으면 둘 다 `aria-describedby`에 들어간다. */
  help?: string;
  /** 라벨·에러를 감싸는 바깥 요소의 추가 클래스. 레이아웃 전용이다(예: flex 항목의 `min-w-0 flex-1`). */
  className?: string;
  /** 컨트롤에 덧붙일 클래스(예: `w-full`). 공통 규격을 덮어쓰지 않고 뒤에 붙는다. */
  controlClassName?: string;
  children: (control: FieldControlProps) => ReactNode;
};

/** 인풋·셀렉트·date가 공유하는 시각 규격. 스타일가이드 §3 — 높이 40, radius 8. */
const CONTROL_BASE =
  "h-10 rounded-lg border bg-surface px-3 text-body text-text outline-none placeholder:text-text-muted focus:border-primary";

export function Field({ label, error, help, className, controlClassName, children }: FieldProps) {
  const id = useId();
  const errorId = error ? `${id}-error` : undefined;
  const helpId = help ? `${id}-help` : undefined;

  // 둘 다 있으면 둘 다 읽어줘야 한다 — 에러만 연결하면 도움말이 스크린리더에서 사라진다.
  const describedBy = [errorId, helpId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={`flex flex-col gap-2 ${className ?? ""}`}>
      <label htmlFor={id} className="text-caption text-text-muted">
        {label}
      </label>

      {children({
        id,
        className: `${CONTROL_BASE} ${error ? "border-error" : "border-border"} ${controlClassName ?? ""}`,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": describedBy,
      })}

      {help ? (
        <p id={helpId} className="text-caption text-text-muted">
          {help}
        </p>
      ) : null}

      {error ? (
        <p id={errorId} role="alert" className="text-caption text-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
