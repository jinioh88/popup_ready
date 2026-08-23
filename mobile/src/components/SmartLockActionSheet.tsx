import { useMemo, useRef, useState } from "react";
import { Animated, PanResponder, Pressable, StyleSheet, Text, View } from "react-native";

import { createSlideGesture } from "../lib/doorlock/slide-gesture";
import type { DoorLockView } from "../lib/doorlock/status";
import { colors, radius, spacing, typography } from "../lib/theme";

const KNOB_SIZE = 56;

type Props = DoorLockView & {
  error: string | null;
  retryInSeconds: number | null;
  onOpen: () => void;
  onReconnect: () => void;
};

/**
 * `SmartLockActionSheet` (스타일가이드 §8.C).
 *
 * - **원터치 슬라이드로 개방한다.** 오탈자 한 번에 문이 열리는 버튼은 쓰지 않는다.
 * - 문구에 '블루투스'·'BLE'를 쓰지 않는다 — 문구는 전부 `lib/doorlock/status.ts`가 만든다.
 * - **색만으로 상태를 전하지 않는다.** 색(`tone`)과 headline 텍스트가 항상 함께 나간다.
 * - 실패 표시에 **플래시 애니메이션을 쓰지 않는다**(WCAG 2.3.1) — 지속 테두리로 대체한다.
 *
 * 제스처는 RN 코어의 `Animated` + `PanResponder`로만 만든다. reanimated·gesture-handler를
 * 이 UI 하나 때문에 들이지 않는다.
 */
export function SmartLockActionSheet({
  headline,
  detail,
  tone,
  canSlide,
  error,
  retryInSeconds,
  onOpen,
  onReconnect,
}: Props) {
  const [trackWidth, setTrackWidth] = useState(0);
  const translateX = useRef(new Animated.Value(0)).current;

  // canSlide·trackWidth가 바뀌면 판정 기준이 달라지므로 응답기를 다시 만든다.
  // 정책(무엇을 열림으로 볼지·응답자를 넘길지)은 `lib/doorlock/slide-gesture.ts`에 있고
  // 여기서는 애니메이션만 붙인다 — 그래야 제스처 수명주기를 테스트로 고정할 수 있다.
  const responder = useMemo(
    () =>
      PanResponder.create(
        createSlideGesture({
          canSlide,
          trackWidth,
          knobWidth: KNOB_SIZE,
          moveKnob: (offset) => translateX.setValue(offset),
          settleKnob: (committed) => {
            // **`useNativeDriver: false`여야 한다.** 이 값은 매 move마다 `setValue`로
            // 밀어 주는데, 네이티브 드라이버로 애니메이션을 한 번이라도 돌리면 노드가
            // 네이티브로 승격되고(RN `AnimatedValue.js:202-210`) 이후 `setValue`가
            // 비동기 배치로 큐잉된다 — 두 번째 제스처부터 손잡이가 손가락을 못 따라온다.
            Animated.spring(translateX, {
              toValue: committed ? Math.max(0, trackWidth - KNOB_SIZE) : 0,
              useNativeDriver: false,
            }).start(() => {
              if (!committed) return;
              translateX.setValue(0);
            });
          },
          onCommit: onOpen,
        }),
      ),
    [canSlide, trackWidth, translateX, onOpen],
  );

  const toneColor = TONE_COLOR[tone];

  return (
    <View style={[styles.card, { borderColor: toneColor }]}>
      <View style={styles.headlineRow}>
        {/* 색 단독 금지 — 상태 점 옆에 항상 문구가 함께 간다. */}
        <View style={[styles.dot, { backgroundColor: toneColor }]} />
        <Text style={[styles.headline, { color: toneColor }]}>{headline}</Text>
      </View>
      <Text style={styles.detail}>{detail}</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View
        style={[styles.track, !canSlide && styles.trackDisabled]}
        onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
        accessibilityRole="adjustable"
        accessibilityLabel="밀어서 문 열기"
        accessibilityState={{ disabled: !canSlide }}
      >
        <Text style={styles.trackLabel}>{canSlide ? "밀어서 문 열기" : "지금은 열 수 없다"}</Text>
        <Animated.View
          testID="doorlock-knob"
          {...responder.panHandlers}
          style={[styles.knob, !canSlide && styles.knobDisabled, { transform: [{ translateX }] }]}
        >
          <Text style={styles.knobLabel}>›</Text>
        </Animated.View>
      </View>

      {retryInSeconds === null ? null : (
        <Pressable style={styles.reconnect} onPress={onReconnect}>
          <Text style={styles.reconnectLabel}>지금 다시 연결</Text>
        </Pressable>
      )}
    </View>
  );
}

const TONE_COLOR: Record<DoorLockView["tone"], string> = {
  neutral: colors.textMuted,
  progress: colors.info,
  success: colors.success,
  warning: colors.warning,
  danger: colors.error,
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    // 실패를 1회 펄스가 아니라 지속 테두리로 알린다(플래시 금지).
    borderWidth: 2,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  headlineRow: { alignItems: "center", flexDirection: "row", gap: spacing.sm },
  dot: { borderRadius: radius.pill, height: 10, width: 10 },
  headline: { ...typography.heading },
  detail: { ...typography.body, color: colors.textMuted },
  error: { ...typography.caption, color: colors.error },
  track: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.pill,
    height: KNOB_SIZE + spacing.xs * 2,
    justifyContent: "center",
    marginTop: spacing.sm,
    padding: spacing.xs,
  },
  trackDisabled: { backgroundColor: colors.border },
  trackLabel: {
    ...typography.bodyStrong,
    color: colors.textMuted,
    position: "absolute",
    textAlign: "center",
    width: "100%",
  },
  knob: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    height: KNOB_SIZE,
    justifyContent: "center",
    width: KNOB_SIZE,
  },
  knobDisabled: { backgroundColor: colors.textMuted },
  knobLabel: { ...typography.title, color: colors.surface },
  reconnect: { alignItems: "center", marginTop: spacing.xs, padding: spacing.sm },
  reconnectLabel: { ...typography.bodyStrong, color: colors.primary },
});
