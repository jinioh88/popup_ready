import { useEffect, useMemo, useState } from "react";

import { isSameLoad, summarizeLoad, type LoadInput, type LoadSummary } from "../../lib/builder/load";
import { DRAG_THROTTLE_MS, throttle } from "../../lib/throttle";

/**
 * 배치 부하 합산의 화면측 배선 (US-103) — 150ms 스로틀 품질 게이트.
 *
 * **스로틀이 지연을 만들지 않는다.** `app/lib/throttle`은 선두 호출을 즉시 실행하고 대기 구간의
 * 마지막 호출만 뒤로 미룬다. 그래서 드롭처럼 띄엄띄엄 일어나는 변경은 **즉시** 반영되고,
 * 연속으로 쏟아지는 변경만 150ms로 묶인다.
 *
 * 이 구분이 중요한 이유 — 2026-08-23 기준 이 화면에서 배치 목록이 실제로 바뀌는 시점은
 * **드롭(`placeItem`)과 드래그 종료(`moveItem`, Konva `onDragEnd`)뿐**이다. 드래그 중
 * 초당 수십 번 발생하는 것은 `BuilderCanvas`의 드롭 미리보기(`setPreview`)이고 그건 스토어를
 * 건드리지 않는다. 즉 오늘의 지배적 경로는 이산 변경이라 스로틀이 걸릴 일이 드물다.
 *
 * 그래도 유틸을 통과시키는 이유는 두 가지다. ① 선두 즉시 실행이라 비용이 0이다.
 * ② 나중에 "드래그 중 예상 부하"처럼 연속 입력이 붙으면 그때 게이트가 저절로 작동한다 —
 * 그 시점에 스로틀을 새로 끼워 넣는 것보다 안전하다.
 *
 * **호출 계약: `items`·`fixtures`·`grid`는 값이 바뀔 때만 새 참조여야 한다.** 렌더마다 새 배열을
 * 넘기면(`items.filter(...)`를 인자 자리에서 만드는 식) 매 렌더 재계산이 예약되고, 스로틀이
 * 대기 구간을 계속 이어붙여 값이 한 박자씩 밀린다. 현재 호출부는 Zustand 셀렉터와 `useMemo`가
 * 참조를 안정적으로 유지하므로 이 조건을 만족한다.
 *
 * 입력을 인자로 넘기는 것은 스로틀 유틸이 **대기 중 마지막 인자**를 보관하기 때문이다.
 * 최신 값을 ref로 들고 다니면 렌더 중 ref 접근이 되어 규칙에도 걸리고, 트레일링 시점에
 * 어떤 값이 쓰이는지도 흐려진다.
 */
export function useLoadSummary(input: LoadInput): LoadSummary {
  const { items, fixtures, grid, maxPowerWatt } = input;

  const [summary, setSummary] = useState<LoadSummary>(() => summarizeLoad(input));

  /**
   * **값이 같으면 이전 객체를 유지한다.** `summarizeLoad`는 매번 새 객체를 돌려주므로 그대로
   * 넣으면 값이 그대로여도 리렌더가 나고, 그 리렌더가 다시 합산을 예약하면(입력 배열 identity가
   * 매 렌더 바뀌는 호출부에서 실제로 그렇게 된다) 상태가 영영 한 박자 뒤처진 채 맴돈다.
   */
  const recompute = useMemo(
    () =>
      throttle((next: LoadInput) => {
        const computed = summarizeLoad(next);
        setSummary((current) => (isSameLoad(current, computed) ? current : computed));
      }, DRAG_THROTTLE_MS),
    [],
  );

  // 대기 중인 트레일링 호출이 언마운트 뒤에 setState를 부르면 안 된다.
  useEffect(() => () => recompute.cancel(), [recompute]);

  useEffect(() => {
    recompute({ items, fixtures, grid, maxPowerWatt });
  }, [items, fixtures, grid, maxPowerWatt, recompute]);

  return summary;
}
