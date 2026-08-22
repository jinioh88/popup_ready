import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

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
        <Stack screenOptions={{ headerBackTitle: "뒤로" }}>
          <Stack.Screen name="index" options={{ title: "로그인" }} />
          <Stack.Screen name="reservations/index" options={{ title: "예약 목록" }} />
          <Stack.Screen name="reservations/[id]" options={{ title: "예약 상세" }} />
        </Stack>
        <StatusBar style="auto" />
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
