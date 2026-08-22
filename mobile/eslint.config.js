// Expo SDK 54 flat config — https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");
const eslintPluginPrettierRecommended = require("eslint-plugin-prettier/recommended");

module.exports = defineConfig([
  expoConfig,
  eslintPluginPrettierRecommended,
  {
    // ESLint 9 flat config는 .eslintignore를 읽지 않는다. 무시 목록은 여기에 둔다.
    ignores: [".expo/", "dist/", "ios/", "android/", "expo-env.d.ts"],
  },
]);
