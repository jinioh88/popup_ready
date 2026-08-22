import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { loginSchema, type LoginInput } from "../../lib/schemas/auth";
import { TextField } from "./TextField";

type LoginFormProps = {
  onSubmit: (values: LoginInput) => Promise<unknown> | void;
  isPending?: boolean;
  /** 서버가 봉투에 실어 준 실패 메시지. */
  errorMessage?: string;
};

export function LoginForm({ onSubmit, isPending, errorMessage }: LoginFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit((values) => onSubmit(values))}>
      <TextField
        id="login-email"
        label="이메일"
        type="email"
        autoComplete="email"
        placeholder="brand@popupready.kr"
        error={errors.email?.message}
        {...register("email")}
      />
      <TextField
        id="login-password"
        label="비밀번호"
        type="password"
        autoComplete="current-password"
        error={errors.password?.message}
        {...register("password")}
      />
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
        {isPending ? "로그인 중…" : "로그인"}
      </button>
    </form>
  );
}
