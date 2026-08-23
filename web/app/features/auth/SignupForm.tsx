import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "../../components/ui/Button";
import { Field } from "../../components/ui/Field";
import { ROLE_LABELS, SIGNUP_ROLES, signupSchema, type SignupInput } from "../../lib/schemas/auth";

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
      <Field label="이름" error={errors.name?.message}>
        {(control) => <input {...control} autoComplete="name" {...register("name")} />}
      </Field>
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
            autoComplete="new-password"
            placeholder="8자 이상"
            {...register("password")}
          />
        )}
      </Field>

      {/* select도 같은 Field를 쓴다 — 인풋 전용으로 만들었으면 여기가 복제본이 됐을 자리다. */}
      <Field label="역할" error={errors.role?.message}>
        {(control) => (
          <select {...control} {...register("role")}>
            {SIGNUP_ROLES.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </select>
        )}
      </Field>

      {errorMessage ? (
        <p role="alert" className="text-caption text-error">
          {errorMessage}
        </p>
      ) : null}
      <Button type="submit" disabled={isPending} className="mt-2">
        {isPending ? "가입 중…" : "가입하기"}
      </Button>
    </form>
  );
}
