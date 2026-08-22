import { Link } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { colors, spacing, typography } from "../../lib/theme";

/**
 * 예약 목록 화면.
 *
 * TODO(US-3xx): `GET /reservations` 연동(TanStack Query).
 * 목록 아이템 타입은 contracts/openapi.json 생성 타입을 쓴다 — 손으로 정의하지 않는다.
 */
export default function ReservationListScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.empty}>예약 데이터는 API 연동 후 표시된다.</Text>

      {/* 골격 확인용 임시 링크 — 목록 연동 시 제거한다. */}
      <Link href="/reservations/demo" style={styles.link}>
        예약 상세 화면으로 이동 (골격 확인용)
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.bg, flex: 1, gap: spacing.lg, padding: spacing.lg },
  empty: { ...typography.body, color: colors.textMuted },
  link: { ...typography.body, color: colors.primary },
});
