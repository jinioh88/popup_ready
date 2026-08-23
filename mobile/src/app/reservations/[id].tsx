import { useQuery } from "@tanstack/react-query";
import Constants from "expo-constants";
import { useLocalSearchParams } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { SmartLockActionSheet } from "../../components/SmartLockActionSheet";
import { useDoorOpen } from "../../hooks/useDoorOpen";
import { resolveApiBaseUrl } from "../../lib/api/config";
import { fetchReservation, parseReservationId } from "../../lib/api/reservations";
import { colors, radius, spacing, typography } from "../../lib/theme";

/**
 * 예약 상세 — 무인 스마트락 체크인(US-301).
 *
 * 실제 하드웨어가 아니라 MQTT 모킹이지만, **화면 문구는 전송 방식을 말하지 않는다**
 * (스타일가이드 §8.C). 문구는 전부 `lib/doorlock/status.ts`가 만든다.
 */
export default function ReservationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const reservationId = parseReservationId(id);

  if (reservationId === null) {
    return (
      <View style={styles.container}>
        <Text style={styles.error}>예약 번호가 올바르지 않다: {id}</Text>
      </View>
    );
  }

  return <ReservationDetail reservationId={reservationId} />;
}

function ReservationDetail({ reservationId }: { reservationId: number }) {
  const baseUrl = resolveApiBaseUrl(Constants.expoConfig?.hostUri, process.env.EXPO_PUBLIC_API_URL);
  const doorLock = useDoorOpen(reservationId);

  const { data: reservation } = useQuery({
    queryKey: ["reservation", baseUrl, reservationId],
    queryFn: () => fetchReservation(baseUrl!, reservationId),
    enabled: Boolean(baseUrl),
  });

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <Text style={styles.label}>예약</Text>
      <Text style={styles.value}>#{reservationId}</Text>
      {reservation ? (
        <Text style={styles.meta}>
          {reservation.startDate} ~ {reservation.endDate}
        </Text>
      ) : null}

      <SmartLockActionSheet
        headline={doorLock.headline}
        detail={doorLock.detail}
        tone={doorLock.tone}
        canSlide={doorLock.canSlide}
        error={doorLock.error}
        retryInSeconds={doorLock.retryInSeconds}
        onOpen={doorLock.open}
        onReconnect={doorLock.reconnectNow}
      />

      {/* 브로커가 상태 토픽으로 되돌려준 값. 개방의 필요조건이 아니라 확인용이다. */}
      {doorLock.lastStatusMessage ? (
        <View style={styles.echoBox}>
          <Text style={styles.label}>도어락 상태 수신</Text>
          <Text style={styles.echo}>{doorLock.lastStatusMessage.payload}</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.bg, flex: 1 },
  container: { gap: spacing.sm, padding: spacing.lg },
  label: { ...typography.caption, color: colors.textMuted, marginTop: spacing.sm },
  value: { ...typography.title, color: colors.text },
  meta: { ...typography.body, color: colors.textMuted, marginBottom: spacing.lg },
  error: { ...typography.body, color: colors.error },
  echoBox: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.card,
    borderWidth: 1,
    gap: spacing.xs,
    marginTop: spacing.lg,
    padding: spacing.lg,
  },
  echo: { ...typography.caption, color: colors.text, fontFamily: "Courier" },
});
