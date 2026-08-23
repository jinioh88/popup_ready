import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { SessionLoading } from "../components/SessionLoading";
import { AuthProvider, useAuthSession } from "../hooks/useAuthSession";

/**
 * 루트 레이아웃 — 모든 라우트보다 먼저 렌더된다. 전역 Provider는 여기에 둔다.
 * (App.tsx를 대체하는 자리)
 */
export default function RootLayout() {
  // QueryClient를 모듈 최상단이 아닌 상태로 두어 Fast Refresh 시 캐시가 유실되지 않게 한다.
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
        <StatusBar style="auto" />
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}

/**
 * 🚧 T0 인증 가드 (지시서 §5 필수 게이트).
 *
 * **가드는 이동이 아니라 등록 차단이다.** `useEffect` + `router.replace`로 짜면 보호 화면이
 * 최소 한 프레임 렌더되고, 그 프레임에서 쿼리·MQTT 연결이 이미 발화한다. 딥링크
 * (`popupready://reservations/{id}`)가 정확히 그 경로로 들어온다.
 *
 * `Stack.Protected`는 guard가 false인 화면을 **네비게이터에 아예 등록하지 않는다.**
 * 등록되지 않은 경로는 딥링크 URL로도 해석되지 않으므로, 화면 이동이든 딥링크든 같은 판정을
 * 지난다. 화면별로 가드를 다는 방식과 달리 빠뜨릴 자리가 없다.
 *
 * 새 화면을 추가하면 반드시 아래 두 블록 중 하나에 넣는다 — `_layout.tsx`에 등록하지 않은
 * 라우트 파일은 expo-router가 자동으로 추가하며 **어느 가드도 지나지 않는다.**
 * `__tests__/route-guard-coverage-test.ts`가 이 누락을 잡는다.
 */
function RootNavigator() {
  const { status } = useAuthSession();

  // "아직 모른다"를 어느 한쪽으로 판정하지 않는다. 여기서 authenticated로 보면 가드가 없는 것과
  // 같고, anonymous로 보면 정상 로그인 사용자가 매번 로그인 화면을 스쳐 간다.
  if (status === "loading") return <SessionLoading />;

  const signedIn = status === "authenticated";

  return (
    <Stack screenOptions={{ headerBackTitle: "뒤로" }}>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="index" options={{ title: "로그인" }} />
      </Stack.Protected>

      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="reservations/index" options={{ title: "예약 목록" }} />
        <Stack.Screen name="reservations/[id]" options={{ title: "예약 상세" }} />
      </Stack.Protected>
    </Stack>
  );
}
