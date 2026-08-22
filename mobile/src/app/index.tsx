import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { colors, radius, spacing, typography } from "../lib/theme";

/**
 * 로그인 화면 (진입점).
 *
 * TODO(US-3xx): `POST /auth/login` 연동 + JWT를 expo-secure-store에 저장.
 * contracts/openapi.json 생성 후 착수한다 — 그 전에 요청/응답 타입을 손으로 굳히지 않는다.
 */
export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>PopupReady 현장 운영</Text>

      <TextInput
        style={styles.input}
        placeholder="이메일"
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="비밀번호"
        placeholderTextColor={colors.textMuted}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <Pressable style={styles.button} onPress={() => router.push("/reservations")}>
        <Text style={styles.buttonLabel}>로그인</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.bg,
    flex: 1,
    gap: spacing.md,
    justifyContent: "center",
    padding: spacing.lg,
  },
  heading: { ...typography.title, color: colors.text, marginBottom: spacing.md },
  input: {
    ...typography.body,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.input,
    borderWidth: 1,
    color: colors.text,
    padding: spacing.md,
  },
  // 주 버튼: primary 배경 + 흰 텍스트, 높이 48(모바일), radius 8 — 가이드 §4.
  button: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radius.input,
    height: 48,
    justifyContent: "center",
    marginTop: spacing.sm,
  },
  buttonLabel: { ...typography.bodyStrong, color: colors.surface },
});
