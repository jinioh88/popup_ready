import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "../../components/ui/Button";
import { Field } from "../../components/ui/Field";
import { loginSchema, type LoginInput } from "../../lib/schemas/auth";

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
      <Field label="이메일" error={errors.email?.message}>
        {(control) => (
          <input
            {...control}
            type="email"
            autoComplete="email"
            placeholder="brand@popupready.kr"
            {...register("email")}
          />
        )}
      </Field>
      <Field label="비밀번호" error={errors.password?.message}>
        {(control) => (
          <input
            {...control}
            type="password"
            autoComplete="current-password"
            {...register("password")}
          />
        )}
      </Field>
      {errorMessage ? (
        <p role="alert" className="text-caption text-error">
          {errorMessage}
        </p>
      ) : null}
      <Button type="submit" disabled={isPending} className="mt-2">
        {isPending ? "로그인 중…" : "로그인"}
      </Button>
    </form>
  );
}
