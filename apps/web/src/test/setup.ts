import "@testing-library/jest-dom";

// jsdom은 URL.createObjectURL/revokeObjectURL을 구현하지 않는다(카메라 촬영 미리보기 테스트용 최소 폴리필).
if (typeof URL.createObjectURL !== "function") {
  let objectUrlCounter = 0;
  URL.createObjectURL = () => `blob:mock-${(objectUrlCounter += 1)}`;
}
if (typeof URL.revokeObjectURL !== "function") {
  URL.revokeObjectURL = () => {};
}

// jsdom은 ResizeObserver를 구현하지 않는다(필기 캔버스 `HandwritingCanvas` 테스트용 최소 폴리필).
if (typeof globalThis.ResizeObserver !== "function") {
  class ResizeObserverPolyfill {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  globalThis.ResizeObserver = ResizeObserverPolyfill;
}

// jsdom은 Path2D를 구현하지 않는다(`strokeToPath`가 생성하는 Path2D용 최소 폴리필 —
// 실제 경로 지오메트리는 필요 없고 `new Path2D(...)`/`.arc(...)` 호출이 에러 없이 동작하기만 하면 된다).
if (typeof globalThis.Path2D !== "function") {
  class Path2DPolyfill {
    constructor(_path?: string) {
      void _path;
    }
    arc(): void {}
  }
  globalThis.Path2D = Path2DPolyfill as unknown as typeof Path2D;
}
