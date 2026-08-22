import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { loginErrorMessage, useLogin } from "../hooks/useLogin";
import { loginFormSchema, type LoginFormValues } from "../lib/api/login-form";
import { colors, radius, spacing, typography } from "../lib/theme";

/** 로그인 화면 (진입점) — POST /auth/login, 토큰은 expo-secure-store에 보관한다. */
export default function LoginScreen() {
  const router = useRouter();
  const { mutate, isPending, error } = useLogin();

  // 폼은 공유 스택(React Hook Form + Zod)을 따른다 — 웹과 검증 규칙을 같은 방식으로 쓴다.
  const { control, handleSubmit, formState } = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: { email: "", password: "" },
  });

  const submit = handleSubmit((values) =>
    mutate(values, { onSuccess: () => router.replace("/reservations") }),
  );

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>PopupReady 현장 운영</Text>

      <Controller
        control={control}
        name="email"
        render={({ field }) => (
          <TextInput
            style={styles.input}
            placeholder="이메일"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            editable={!isPending}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
          />
        )}
      />
      {formState.errors.email ? (
        <Text style={styles.error}>{formState.errors.email.message}</Text>
      ) : null}

      <Controller
        control={control}
        name="password"
        render={({ field }) => (
          <TextInput
            style={styles.input}
            placeholder="비밀번호"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            editable={!isPending}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            onSubmitEditing={submit}
          />
        )}
      />
      {formState.errors.password ? (
        <Text style={styles.error}>{formState.errors.password.message}</Text>
      ) : null}

      {error ? <Text style={styles.error}>{loginErrorMessage(error)}</Text> : null}

      <Pressable
        style={[styles.button, isPending && styles.buttonDisabled]}
        disabled={isPending}
        onPress={submit}
      >
        {isPending ? (
          <ActivityIndicator color={colors.surface} />
        ) : (
          <Text style={styles.buttonLabel}>로그인</Text>
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
  // 가이드에 disabled 토큰이 없어 뉴트럴 토큰(border)으로 표현한다.
  buttonDisabled: { backgroundColor: colors.border },
  buttonLabel: { ...typography.bodyStrong, color: colors.surface },
});
