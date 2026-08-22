import { useLocalSearchParams } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useDoorLock } from "../../hooks/useDoorLock";
import { colors, radius, spacing, typography } from "../../lib/theme";

const STATUS_LABEL = {
  idle: "대기",
  connecting: "브로커 연결 중…",
  connected: "연결됨",
  error: "연결 실패",
} as const;

/** 예약 상세 — 도어락 체크인(US-301). 실제 BLE가 아니라 MQTT 모킹이다. */
export default function ReservationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { status, brokerUrl, topic, lastEcho, error, unlock } = useDoorLock(id);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>예약 ID</Text>
      <Text style={styles.value}>{id}</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>도어락 (MQTT 모킹)</Text>
        <Text style={styles.meta}>브로커 {brokerUrl ?? "미확인"}</Text>
        <Text style={styles.meta}>토픽 {topic}</Text>
        <Text style={styles.meta}>상태 {STATUS_LABEL[status]}</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>

      <Pressable
        style={[styles.button, status !== "connected" && styles.buttonDisabled]}
        disabled={status !== "connected"}
        onPress={unlock}
      >
        <Text style={[styles.buttonLabel, status !== "connected" && styles.buttonLabelDisabled]}>
          도어락 열기
        </Text>
      </Pressable>

      {/* 발행한 신호를 같은 토픽 구독으로 되받아 브로커 왕복을 눈으로 확인한다. */}
      <Text style={styles.label}>브로커 응답</Text>
      <Text style={styles.echo}>{lastEcho ?? "아직 없음"}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.bg, flex: 1, gap: spacing.sm, padding: spacing.lg },
  label: { ...typography.caption, color: colors.textMuted, marginTop: spacing.sm },
  value: { ...typography.bodyStrong, color: colors.text },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.card,
    borderWidth: 1,
    gap: spacing.xs,
    marginTop: spacing.lg,
    padding: spacing.lg,
  },
  cardTitle: { ...typography.heading, color: colors.text, marginBottom: spacing.xs },
  meta: { ...typography.caption, color: colors.textMuted },
  error: { ...typography.caption, color: colors.error, marginTop: spacing.xs },
  // 주 버튼: primary 배경 + 흰 텍스트, 높이 48(모바일), radius 8 — 가이드 §4.
  button: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radius.input,
    height: 48,
    justifyContent: "center",
    marginTop: spacing.lg,
  },
  // 가이드에 disabled 토큰이 없어 뉴트럴 토큰(border/textMuted)으로 표현한다.
  buttonDisabled: { backgroundColor: colors.border },
  buttonLabel: { ...typography.bodyStrong, color: colors.surface },
  buttonLabelDisabled: { color: colors.textMuted },
  echo: { ...typography.caption, color: colors.text, fontFamily: "Courier" },
});
