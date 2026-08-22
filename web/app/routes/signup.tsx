import { AuthCard } from "../features/auth/AuthCard";
import { SignupForm } from "../features/auth/SignupForm";

export function meta() {
  return [{ title: "회원가입 · PopupReady" }];
}

export default function SignupRoute() {
  return (
    <AuthCard
      title="회원가입"
      description="브랜드·건물주·집기 공급사 계정을 만들 수 있습니다."
      footer={{ text: "이미 계정이 있으신가요?", linkLabel: "로그인", to: "/login" }}
    >
      {/* 제출 뮤테이션 배선은 B-5 (인증 API 목업 연동) */}
      <SignupForm />
    </AuthCard>
  );
}
