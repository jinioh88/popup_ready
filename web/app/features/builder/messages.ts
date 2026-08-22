import type { PlacementRejection } from "../../lib/builder/collision";

/**
 * 배치 거부 사유 → 사용자 안내 문구.
 *
 * 캔버스 드롭·이동과 회전은 같은 사유를 서로 다른 맥락으로 설명해야 해서 두 벌이지만,
 * 문구 자체는 여기 한 곳에만 둔다 — 두 곳에 흩어져 있으면 한쪽만 고쳐진다.
 */
export function placementRejectionMessage(reason: PlacementRejection): string {
  switch (reason) {
    case "OUT_OF_BOUNDS":
      return "도면 범위를 벗어나 배치할 수 없습니다.";
    case "OVERLAP":
      return "다른 집기와 겹쳐 배치할 수 없습니다.";
    case "UNKNOWN_FIXTURE":
      return "집기 정보를 아직 불러오지 못했습니다.";
  }
}

export function rotationRejectionMessage(reason: PlacementRejection): string {
  switch (reason) {
    case "OUT_OF_BOUNDS":
      return "회전하면 도면 범위를 벗어납니다.";
    case "OVERLAP":
      return "회전하면 다른 집기와 겹칩니다.";
    case "UNKNOWN_FIXTURE":
      return "집기 정보를 아직 불러오지 못했습니다.";
  }
}
