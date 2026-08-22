import { AuthCard } from "../features/auth/AuthCard";
import { SignupForm } from "../features/auth/SignupForm";
import { useSignup } from "../features/auth/useAuthMutations";

export function meta() {
  return [{ title: "회원가입 · PopupReady" }];
}

export default function SignupRoute() {
  const { submit, isPending, errorMessage } = useSignup();

  return (
    <AuthCard
      title="회원가입"
      description="브랜드·건물주·집기 공급사 계정을 만들 수 있습니다."
      footer={{ text: "이미 계정이 있으신가요?", linkLabel: "로그인", to: "/login" }}
    >
      <SignupForm onSubmit={submit} isPending={isPending} errorMessage={errorMessage} />
    </AuthCard>
  );
}
