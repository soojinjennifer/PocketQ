import { act } from "@testing-library/react";

function getJsdomImpl(wrapper: object, label: string): object {
  const implSymbol = Object.getOwnPropertySymbols(wrapper).find((symbol) => symbol.description === "impl");
  const impl: unknown = implSymbol ? Reflect.get(wrapper, implSymbol) : undefined;
  if (typeof impl !== "object" || impl === null) {
    throw new Error(`dispatchTrustedClick: jsdom ${label} 구현 객체를 찾지 못했습니다.`);
  }
  return impl;
}

/**
 * 사용자 입력과 같은 신뢰된(`isTrusted === true`) click을 대상에 디스패치한다(테스트 전용).
 *
 * jsdom은 브라우저와 같은 규칙으로 `dispatchEvent`/`fireEvent`/`element.click()`이 보낸 이벤트를 항상
 * `isTrusted === false`로 만든다(`dispatchEvent`가 디스패치 직전에 강제로 false로 되돌린다). `ActionMenu`
 * 처럼 사용자 입력 click만 처리하는 코드를 검증하려면 신뢰된 click이 필요하므로, jsdom 내부 구현
 * 객체(`Symbol(impl)`)의 `isTrusted`를 true로 바꾸고 내부 `_dispatch`로 직접 디스패치한다. jsdom 내부
 * 구조에 의존하므로, jsdom 업그레이드로 구조가 바뀌면 조용히 통과하지 않고 즉시 예외를 던진다.
 *
 * @returns 디스패치 결과(`preventDefault()`가 호출됐으면 false).
 */
export function dispatchTrustedClick(target: Element): boolean {
  const event = new MouseEvent("click", { bubbles: true, cancelable: true, composed: true });
  const eventImpl = getJsdomImpl(event, "Event");
  const targetImpl = getJsdomImpl(target, "EventTarget");
  const dispatch: unknown = Reflect.get(targetImpl, "_dispatch");
  if (typeof dispatch !== "function") {
    throw new Error("dispatchTrustedClick: jsdom 내부 _dispatch를 찾지 못했습니다.");
  }
  Reflect.set(eventImpl, "isTrusted", true);
  if (!event.isTrusted) {
    throw new Error("dispatchTrustedClick: isTrusted를 true로 설정하지 못했습니다.");
  }
  let notCanceled = true;
  act(() => {
    notCanceled = Boolean(Reflect.apply(dispatch, targetImpl, [eventImpl]));
  });
  return notCanceled;
}
