import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCameraCapture } from "./useCameraCapture";

const getUserMedia = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(globalThis.navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia },
  });
});

afterEach(() => {
  Reflect.deleteProperty(globalThis.navigator, "mediaDevices");
});

describe("useCameraCapture", () => {
  it("getUserMedia가 허용되면 isReady가 true가 되고 error는 없다", async () => {
    const stop = vi.fn();
    getUserMedia.mockResolvedValue({ getTracks: () => [{ stop }] });

    const { result } = renderHook(() => useCameraCapture());

    await waitFor(() => expect(result.current.isReady).toBe(true));
    expect(result.current.error).toBeNull();
  });

  it("getUserMedia가 권한 거부(NotAllowedError)로 실패하면 permission-denied 에러를 반환한다", async () => {
    getUserMedia.mockRejectedValue(new DOMException("denied", "NotAllowedError"));

    const { result } = renderHook(() => useCameraCapture());

    await waitFor(() => expect(result.current.error).toBe("permission-denied"));
    expect(result.current.isReady).toBe(false);
  });

  it("getUserMedia를 지원하지 않으면 unsupported 에러를 반환한다", async () => {
    Reflect.deleteProperty(globalThis.navigator, "mediaDevices");

    const { result } = renderHook(() => useCameraCapture());

    await waitFor(() => expect(result.current.error).toBe("unsupported"));
  });

  it("stopStream 호출 시 트랙을 정지한다", async () => {
    const stop = vi.fn();
    getUserMedia.mockResolvedValue({ getTracks: () => [{ stop }] });

    const { result } = renderHook(() => useCameraCapture());
    await waitFor(() => expect(result.current.isReady).toBe(true));

    result.current.stopStream();

    expect(stop).toHaveBeenCalledTimes(1);
  });
});
