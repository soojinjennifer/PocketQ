import { act, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import { VIEWPORT_CENTER_ROOT_MARGIN } from "../shared/ui/video-embed/useViewportPlayback";

/**
 * `YouTubeEmbed`(autoplayOnView) 테스트용 대역. IntersectionObserver는 테스트마다 `vi.stubGlobal`로 끼우고
 * (전역 폴리필 없음), 테스트 쪽 `afterEach`에서 `vi.unstubAllGlobals()`로 걷는다.
 */

export const NOCOOKIE_ORIGIN = "https://www.youtube-nocookie.com";

interface FakeObserver {
  callback: IntersectionObserverCallback;
  options: IntersectionObserverInit;
  observed: Element[];
  disconnected: boolean;
}

export interface ViewportControls {
  /** 화면 가운데 선을 지남(완전히 보임). */
  enterCenter: () => void;
  /** 거의 다 화면 밖(10%만 보임). */
  leave: () => void;
  setRatio: (ratio: number) => void;
  /** 가운데 선 교차 여부만 바꾼다(가시 비율은 그대로). */
  setCenter: (hit: boolean) => void;
}

export function stubIntersectionObserver() {
  const observers: FakeObserver[] = [];
  const constructorSpy = vi.fn();
  class FakeIntersectionObserver {
    private readonly record: FakeObserver;
    constructor(callback: IntersectionObserverCallback, options: IntersectionObserverInit = {}) {
      constructorSpy(options);
      this.record = { callback, options, observed: [], disconnected: false };
      observers.push(this.record);
    }
    observe(target: Element) {
      this.record.observed.push(target);
    }
    unobserve() {}
    disconnect() {
      this.record.disconnected = true;
    }
    takeRecords() {
      return [];
    }
  }
  vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);

  const emit = (observer: FakeObserver | undefined, isIntersecting: boolean, ratio: number) => {
    if (!observer) throw new Error("관찰자가 없다");
    const target = observer.observed[0];
    if (!target) throw new Error("관찰 대상이 없다");
    const entry = {
      isIntersecting,
      intersectionRatio: ratio,
      target,
    } as unknown as IntersectionObserverEntry;
    act(() => observer.callback([entry], {} as IntersectionObserver));
  };

  /** `matches`에 맞는 요소를 관찰하는 관찰자 쌍(가운데 선·가시 비율)을 조종한다. */
  const controlsFor = (matches: (target: Element) => boolean): ViewportControls => {
    const ofTarget = observers.filter((o) => o.observed.some(matches));
    const center = () => ofTarget.find((o) => o.options.rootMargin === VIEWPORT_CENTER_ROOT_MARGIN);
    const visibility = () =>
      ofTarget.find((o) => o.options.rootMargin !== VIEWPORT_CENTER_ROOT_MARGIN);
    return {
      enterCenter: () => {
        emit(visibility(), true, 1);
        emit(center(), true, 0);
      },
      leave: () => {
        emit(center(), false, 0);
        emit(visibility(), true, 0.1);
      },
      setRatio: (ratio) => emit(visibility(), ratio > 0, ratio),
      setCenter: (hit) => emit(center(), hit, 0),
    };
  };

  return {
    observers,
    constructorSpy,
    controlsFor,
    /** 첫 번째(단일 영상 테스트의 유일한) 관찰 대상. 관찰자가 생긴 뒤에 불러야 한다. */
    ...lazyControls(() => controlsFor(() => true)),
  };
}

/** 렌더 뒤에 관찰자가 생기므로, 호출 시점에 대상을 찾는다. */
function lazyControls(get: () => ViewportControls): ViewportControls {
  return {
    enterCenter: () => get().enterCenter(),
    leave: () => get().leave(),
    setRatio: (ratio) => get().setRatio(ratio),
    setCenter: (hit) => get().setCenter(hit),
  };
}

/** iframe load 뒤 contentWindow.postMessage를 엿본다. */
export function loadAndSpy(iframe: HTMLIFrameElement) {
  const contentWindow = iframe.contentWindow;
  if (!contentWindow) throw new Error("contentWindow가 없다");
  const postMessage = vi.spyOn(contentWindow, "postMessage").mockImplementation(() => {});
  fireEvent.load(iframe);
  const commands = () =>
    postMessage.mock.calls
      .map(([data, targetOrigin]) => ({
        payload: JSON.parse(String(data)) as { event: string; func?: string },
        targetOrigin,
      }))
      .filter(({ payload }) => payload.event === "command");
  return {
    postMessage,
    contentWindow,
    commands,
    funcs: () => commands().map(({ payload }) => payload.func),
  };
}

/** 플레이어 상태 알림(onStateChange). 상태 알림은 플레이어 준비 신호도 겸한다. */
export function sendPlayerState(source: Window | null, state: number, origin = NOCOOKIE_ORIGIN) {
  act(() => {
    window.dispatchEvent(
      new MessageEvent("message", {
        origin,
        source,
        data: JSON.stringify({ event: "onStateChange", info: state }),
      }),
    );
  });
}
