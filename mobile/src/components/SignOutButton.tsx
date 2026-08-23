import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";

import { useAuthSession } from "../hooks/useAuthSession";
import { colors, spacing, typography } from "../lib/theme";

/**
 * 로그아웃 버튼 (헤더 우측).
 *
 * **여기서 화면을 이동시키지 않는다.** 토큰을 지우면 세션이 `anonymous`가 되고, 루트
 * 레이아웃의 `Stack.Protected`가 보호 라우트를 등록 해제하면서 로그인 화면만 남는다 —
 * 딥링크로 들어온 경우와 같은 판정을 지나게 하려는 것이 가드의 설계다.
 *
 * 이 버튼이 없으면 **로그아웃 상태를 만들 방법이 앱 안에 없다.** SecureStore의 토큰은 앱을
 * 종료해도 남으므로, 딥링크 차단 인수 테스트(§11.1-A)의 전제 자체가 성립하지 않는다.
 */
export function SignOutButton() {
  const { signOut } = useAuthSession();
  const queryClient = useQueryClient();
  const [failed, setFailed] = useState(false);

  const press = async () => {
    try {
      await signOut();
      // 다음에 로그인하는 사람이 앞사람의 예약을 보지 않게 서버 상태 캐시까지 비운다.
      // 토큰만 지우면 쿼리 캐시는 그대로 남아 재로그인 직후 한 프레임 노출된다.
      queryClient.clear();
    } catch {
      // 저장소를 못 지웠으면 토큰이 남아 있다. 로그아웃된 척하지 않고 실패를 드러낸다.
      setFailed(true);
    }
  };

  return (
    <Pressable onPress={press} accessibilityRole="button" hitSlop={spacing.sm}>
      <Text style={[styles.label, failed && styles.failed]}>
        {failed ? "로그아웃 실패" : "로그아웃"}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  label: { ...typography.bodyStrong, color: colors.primary },
  failed: { color: colors.error },
});
