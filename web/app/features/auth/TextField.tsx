import type { ComponentPropsWithRef } from "react";

type TextFieldProps = ComponentPropsWithRef<"input"> & {
  label: string;
  error?: string;
};

/** 라벨 + 인풋 + 에러 메시지. RHF `register()` 결과를 그대로 펼쳐 넘길 수 있다. */
export function TextField({ label, error, id, className, ...inputProps }: TextFieldProps) {
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-caption text-text-muted">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        className={`h-10 rounded-lg border bg-surface px-3 text-body text-text outline-none placeholder:text-text-muted focus:border-primary ${
          error ? "border-error" : "border-border"
        } ${className ?? ""}`}
        {...inputProps}
      />
      {error ? (
        <p id={errorId} role="alert" className="text-caption text-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
