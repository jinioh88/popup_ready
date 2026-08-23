import { useQuery } from "@tanstack/react-query";
import Constants from "expo-constants";
import { Link } from "expo-router";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { resolveApiBaseUrl } from "../../lib/api/config";
import {
  fetchMyReservations,
  reservationStatusLabel,
  type ReservationSummary,
} from "../../lib/api/reservations";
import { colors, radius, spacing, typography } from "../../lib/theme";

/**
 * 예약 목록 — `GET /reservation-requests`. 서버가 **내가 만든 예약만** 최근 순으로 준다.
 *
 * 남의 예약을 볼 경로가 없으므로 403 분기를 두지 않는다(계약 §2.2-A).
 */
export default function ReservationListScreen() {
  const baseUrl = resolveApiBaseUrl(Constants.expoConfig?.hostUri, process.env.EXPO_PUBLIC_API_URL);

  const { data, isPending, error } = useQuery({
    queryKey: ["reservations", baseUrl],
    queryFn: () => fetchMyReservations(baseUrl!),
    enabled: Boolean(baseUrl),
  });

  if (!baseUrl) {
    return <Centered>API 주소를 확인할 수 없다. EXPO_PUBLIC_API_URL을 지정하라.</Centered>;
  }
  if (isPending) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (error) return <Centered>예약을 불러오지 못했다: {error.message}</Centered>;
  if (!data?.length) return <Centered>아직 예약이 없다.</Centered>;

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.listContent}
      data={data}
      keyExtractor={(item) => String(item.id)}
      renderItem={({ item }) => <ReservationRow reservation={item} />}
    />
  );
}

function ReservationRow({ reservation }: { reservation: ReservationSummary }) {
  return (
    // `asChild`가 없으면 Link가 children을 <Text>로 감싼다 — 그 안의 <View>는
    // Text 안의 View가 되어 안드로이드에서 레이아웃이 무너진다. 테스트는 통과하고
    // 기기에서만 깨지는 자리라 구조로 막는다.
    <Link href={`/reservations/${reservation.id}`} asChild>
      <Pressable style={styles.card}>
        <Text style={styles.cardTitle}>예약 #{reservation.id}</Text>
        <Text style={styles.cardMeta}>
          {reservation.startDate} ~ {reservation.endDate}
        </Text>
        <Text style={styles.cardStatus}>{reservationStatusLabel(reservation.status)}</Text>
      </Pressable>
    </Link>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.centered}>
      <Text style={styles.empty}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { backgroundColor: colors.bg, flex: 1 },
  listContent: { gap: spacing.md, padding: spacing.lg },
  centered: {
    alignItems: "center",
    backgroundColor: colors.bg,
    flex: 1,
    justifyContent: "center",
    padding: spacing.lg,
  },
  empty: { ...typography.body, color: colors.textMuted, textAlign: "center" },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.card,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.lg,
  },
  cardTitle: { ...typography.heading, color: colors.text },
  cardMeta: { ...typography.caption, color: colors.textMuted },
  cardStatus: { ...typography.caption, color: colors.primary },
});
