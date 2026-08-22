import type { Config } from "@react-router/dev/config";

export default {
  // SPA 모드. 정적 산출물 유지가 전제이므로 ssr:true 전환은 PM 승인 사항 (ADR-0001).
  ssr: false,
} satisfies Config;
