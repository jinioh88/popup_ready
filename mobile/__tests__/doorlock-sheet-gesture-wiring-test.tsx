import { render, screen } from "@testing-library/react-native";

import { SmartLockActionSheet } from "../src/components/SmartLockActionSheet";

/**
 * 정책 모듈이 **실제로 손잡이에 붙어 있는지** 확인한다.
 *
 * `doorlock-slide-gesture-test.ts`는 정책 함수만 본다 — 컴포넌트가 그 config를
 * `PanResponder.create`에 넘기지 않아도 통과한다. 배선이 끊기면 실기기 결함이 그대로
 * 돌아오므로 여기서 한 줄로 못 박는다.
 */
function renderSheet() {
  return render(
    <SmartLockActionSheet
      headline="연결됨"
      detail="밀어서 문을 연다"
      tone="success"
      canSlide
      error={null}
      retryInSeconds={null}
      onOpen={jest.fn()}
      onReconnect={jest.fn()}
    />,
  );
}

describe("슬라이드 손잡이 배선", () => {
  it("손잡이가 응답자 양보 요청을 거절한다", async () => {
    await renderSheet();

    // RN 기본값은 true다 — 정책이 안 붙어 있으면 여기서 true가 나온다.
    const knob = screen.getByTestId("doorlock-knob");
    expect(knob.props.onResponderTerminationRequest({})).toBe(false);
  });

  it("손잡이에 제스처 핸들러가 붙어 있다", async () => {
    await renderSheet();

    const knob = screen.getByTestId("doorlock-knob");
    expect(typeof knob.props.onResponderMove).toBe("function");
    expect(typeof knob.props.onResponderRelease).toBe("function");
    expect(typeof knob.props.onResponderTerminate).toBe("function");
  });
});
