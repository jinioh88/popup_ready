import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, loadEnv } from "vite";

/** 실 API 통합 시 개발 서버가 프록시할 백엔드 주소. */
const DEFAULT_API_TARGET = "http://localhost:8080";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");

  /**
   * 테스트에서는 reactRouter() 플러그인을 빼야 한다.
   *
   * 이 플러그인은 Fast Refresh preamble을 주입하는데, 그 preamble은 dev 서버가 만드는 실제 HTML
   * 문서에만 존재한다. Vitest+jsdom에서 컴포넌트를 렌더하면 "can't detect preamble"로 죽는다.
   * JSX 변환은 tsconfig의 `jsx: "react-jsx"`를 보고 esbuild가 처리하므로
   * **`@vitejs/plugin-react`를 추가하지 않는다**(web/CLAUDE.md 아키텍처 제약).
   */
  const isTest = Boolean(process.env.VITEST);

  return {
    plugins: isTest ? [tailwindcss()] : [tailwindcss(), reactRouter()],
    server: {
      /**
       * `/api`를 백엔드로 프록시한다.
       *
       * 브라우저에서 보면 같은 오리진이라 CORS 설정 없이 통합할 수 있고, 프로덕션에서
       * 정적 산출물과 API를 같은 오리진 뒤에 두는 배포 형태와도 모양이 같다.
       * 목업(MSW)을 쓰는 동안에는 요청이 워커에서 가로채이므로 여기까지 오지 않는다.
       */
      proxy: {
        "/api": {
          target: env.VITE_API_PROXY_TARGET || DEFAULT_API_TARGET,
          changeOrigin: true,
        },
      },
    },
  };
});
