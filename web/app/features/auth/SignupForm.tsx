import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { ROLE_LABELS, SIGNUP_ROLES, signupSchema, type SignupInput } from "../../lib/schemas/auth";
import { TextField } from "./TextField";

type SignupFormProps = {
  onSubmit: (values: SignupInput) => Promise<unknown> | void;
  isPending?: boolean;
  /** 서버가 봉투에 실어 준 실패 메시지. */
  errorMessage?: string;
};

export function SignupForm({ onSubmit, isPending, errorMessage }: SignupFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: { email: "", password: "", name: "", role: "BRAND" },
  });

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit((values) => onSubmit(values))}>
      <TextField
        id="signup-name"
        label="이름"
        autoComplete="name"
        error={errors.name?.message}
        {...register("name")}
      />
      <TextField
        id="signup-email"
        label="이메일"
        type="email"
        autoComplete="email"
        placeholder="brand@popupready.kr"
        error={errors.email?.message}
        {...register("email")}
      />
      <TextField
        id="signup-password"
        label="비밀번호"
        type="password"
        autoComplete="new-password"
        placeholder="8자 이상"
        error={errors.password?.message}
        {...register("password")}
      />

      <div className="flex flex-col gap-2">
        <label htmlFor="signup-role" className="text-caption text-text-muted">
          역할
        </label>
        <select
          id="signup-role"
          className="h-10 rounded-lg border border-border bg-surface px-3 text-body text-text outline-none focus:border-primary"
          {...register("role")}
        >
          {SIGNUP_ROLES.map((role) => (
            <option key={role} value={role}>
              {ROLE_LABELS[role]}
            </option>
          ))}
        </select>
      </div>

      {errorMessage ? (
        <p role="alert" className="text-caption text-error">
          {errorMessage}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={isPending}
        className="mt-2 h-10 rounded-lg bg-primary text-body-strong text-white hover:bg-primary-dark disabled:opacity-60"
      >
        {isPending ? "가입 중…" : "가입하기"}
      </button>
    </form>
  );
}
