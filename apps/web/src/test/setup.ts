import "@testing-library/jest-dom";

// jsdom은 URL.createObjectURL/revokeObjectURL을 구현하지 않는다(카메라 촬영 미리보기 테스트용 최소 폴리필).
if (typeof URL.createObjectURL !== "function") {
  let objectUrlCounter = 0;
  URL.createObjectURL = () => `blob:mock-${(objectUrlCounter += 1)}`;
}
if (typeof URL.revokeObjectURL !== "function") {
  URL.revokeObjectURL = () => {};
}
