import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { loginErrorMessage, useLogin } from "../hooks/useLogin";
import { colors, radius, spacing, typography } from "../lib/theme";

/** 로그인 화면 (진입점) — POST /auth/login, 토큰은 expo-secure-store에 보관한다. */
export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { mutate, isPending, error } = useLogin();

  const canSubmit = email.trim().length > 0 && password.length > 0 && !isPending;

  const submit = () => {
    if (!canSubmit) return;
    mutate({ email: email.trim(), password }, { onSuccess: () => router.replace("/reservations") });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>PopupReady 현장 운영</Text>

      <TextInput
        style={styles.input}
        placeholder="이메일"
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        editable={!isPending}
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="비밀번호"
        placeholderTextColor={colors.textMuted}
        secureTextEntry
        editable={!isPending}
        value={password}
        onChangeText={setPassword}
        onSubmitEditing={submit}
      />

      {error ? <Text style={styles.error}>{loginErrorMessage(error)}</Text> : null}

      <Pressable
        style={[styles.button, !canSubmit && styles.buttonDisabled]}
        disabled={!canSubmit}
        onPress={submit}
      >
        {isPending ? (
          <ActivityIndicator color={colors.surface} />
        ) : (
          <Text style={[styles.buttonLabel, !canSubmit && styles.buttonLabelDisabled]}>로그인</Text>
        )}
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
  error: { ...typography.caption, color: colors.error },
  // 주 버튼: primary 배경 + 흰 텍스트, 높이 48(모바일), radius 8 — 가이드 §4.
  button: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radius.input,
    height: 48,
    justifyContent: "center",
    marginTop: spacing.sm,
  },
  // 가이드에 disabled 토큰이 없어 뉴트럴 토큰(border/textMuted)으로 표현한다.
  buttonDisabled: { backgroundColor: colors.border },
  buttonLabel: { ...typography.bodyStrong, color: colors.surface },
  buttonLabelDisabled: { color: colors.textMuted },
});
