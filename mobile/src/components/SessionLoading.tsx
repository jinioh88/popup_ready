import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { colors, spacing, typography } from "../lib/theme";

/**
 * 토큰을 읽는 동안 보여주는 화면.
 *
 * 이 자리에 보호 화면을 렌더하지 않는 것이 T0 가드의 절반이다 — 한 프레임만 렌더돼도
 * 그 화면의 쿼리·MQTT 연결은 이미 발화한다.
 */
export function SessionLoading() {
  return (
    <View style={styles.container}>
      <ActivityIndicator color={colors.primary} />
      <Text style={styles.label}>로그인 상태를 확인하는 중</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    backgroundColor: colors.bg,
    flex: 1,
    gap: spacing.md,
    justifyContent: "center",
    padding: spacing.lg,
  },
  label: { ...typography.body, color: colors.textMuted },
});
