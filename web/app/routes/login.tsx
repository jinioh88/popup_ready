import { AuthCard } from "../features/auth/AuthCard";
import { LoginForm } from "../features/auth/LoginForm";

export function meta() {
  return [{ title: "로그인 · PopupReady" }];
}

export default function LoginRoute() {
  return (
    <AuthCard
      title="로그인"
      description="팝업스토어 공간을 찾고 예약하려면 로그인하세요."
      footer={{ text: "아직 계정이 없으신가요?", linkLabel: "회원가입", to: "/signup" }}
    >
      {/* 제출 뮤테이션 배선은 B-5 (인증 API 목업 연동) */}
      <LoginForm />
    </AuthCard>
  );
}
