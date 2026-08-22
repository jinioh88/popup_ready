import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  // public/mockServiceWorker.js는 msw가 생성한 파일이라 우리가 손대지 않는다.
  globalIgnores(["dist", "build", ".react-router", "public/mockServiceWorker.js"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    // React Router 프레임워크 모드의 라우트 모듈 규약 export를 허용한다.
    files: ["app/root.tsx", "app/routes/**/*.tsx"],
    rules: {
      "react-refresh/only-export-components": [
        "error",
        {
          allowExportNames: [
            "meta",
            "links",
            "handle",
            "loader",
            "clientLoader",
            "clientAction",
            "shouldRevalidate",
          ],
        },
      ],
    },
  },
]);
