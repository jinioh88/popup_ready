import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, loadEnv } from "vite";

/** 실 API 통합 시 개발 서버가 프록시할 백엔드 주소. */
const DEFAULT_API_TARGET = "http://localhost:8080";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");

  return {
    plugins: [tailwindcss(), reactRouter()],
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
