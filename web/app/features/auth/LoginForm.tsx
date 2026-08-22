import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { loginSchema, type LoginInput } from "../../lib/schemas/auth";
import { TextField } from "./TextField";

type LoginFormProps = {
  /** 제출 처리. 실제 API 뮤테이션 배선은 B-5에서 연결한다. */
  onSubmit?: (values: LoginInput) => Promise<void> | void;
};

export function LoginForm({ onSubmit }: LoginFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit((values) => onSubmit?.(values))}>
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
      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-2 h-10 rounded-lg bg-primary text-body-strong text-white hover:bg-primary-dark disabled:opacity-60"
      >
        로그인
      </button>
    </form>
  );
}
