import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PreparePhotoResult } from "./preparePhotoForUpload";
import { usePhotoUpload } from "./usePhotoUpload";

const setCapturedImage = vi.fn();

vi.mock("./useProblemInput", () => ({
  useProblemInput: () => ({ setCapturedImage }),
}));

type Prepare = (file: File) => Promise<PreparePhotoResult>;

function Harness({ prepare, onUploaded }: { prepare: Prepare; onUploaded: () => void }) {
  const { openPicker, inputProps, isProcessing, errorKind, dismissError } = usePhotoUpload({
    onUploaded,
    prepare,
  });
  return (
    <div>
      <button type="button" onClick={openPicker}>
        열기
      </button>
      <input {...inputProps} />
      <span data-testid="processing">{String(isProcessing)}</span>
      <span data-testid="error">{errorKind ?? "none"}</span>
      <button type="button" onClick={dismissError}>
        닫기
      </button>
    </div>
  );
}

function selectFile(input: HTMLElement, files: File[]) {
  Object.defineProperty(input, "files", { value: files, configurable: true });
  fireEvent.change(input);
}

function photo(name = "a.jpg"): File {
  return new File(["x"], name, { type: "image/jpeg" });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe("usePhotoUpload", () => {
  beforeEach(() => {
    setCapturedImage.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("input 속성: file/accept=image/*이며 capture·multiple이 없다", () => {
    render(<Harness prepare={vi.fn()} onUploaded={vi.fn()} />);
    const input = screen.getByTestId("photo-upload-input");

    expect(input).toHaveAttribute("type", "file");
    expect(input).toHaveAttribute("accept", "image/*");
    expect(input).not.toHaveAttribute("capture");
    expect(input).not.toHaveAttribute("multiple");
    expect(input).toHaveAttribute("aria-hidden", "true");
    expect(input).toHaveAttribute("tabindex", "-1");
    expect(input).toHaveClass("sr-only");
  });

  it("openPicker는 동기적으로 input.click()을 호출한다", () => {
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => undefined);
    render(<Harness prepare={vi.fn()} onUploaded={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "열기" }));

    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it("정상: 정규화한 Blob으로 setCapturedImage → onUploaded 순으로 호출하고 input을 초기화한다", async () => {
    const jpeg = new Blob(["j"], { type: "image/jpeg" });
    const prepare = vi.fn<Prepare>().mockResolvedValue({ ok: true, blob: jpeg });
    const onUploaded = vi.fn();
    render(<Harness prepare={prepare} onUploaded={onUploaded} />);
    const input = screen.getByTestId<HTMLInputElement>("photo-upload-input");
    const valueSetter = vi.spyOn(input, "value", "set");

    selectFile(input, [photo()]);

    await waitFor(() => expect(onUploaded).toHaveBeenCalledTimes(1));
    expect(setCapturedImage).toHaveBeenCalledWith(jpeg);
    expect(setCapturedImage.mock.invocationCallOrder[0] ?? Infinity).toBeLessThan(
      onUploaded.mock.invocationCallOrder[0] ?? -Infinity,
    );
    expect(valueSetter).toHaveBeenCalledWith("");
    expect(screen.getByTestId("processing")).toHaveTextContent("false");
    expect(screen.getByTestId("error")).toHaveTextContent("none");
  });

  it("선택 취소(files 없음)면 아무 동작도 하지 않는다", () => {
    const prepare = vi.fn<Prepare>();
    const onUploaded = vi.fn();
    render(<Harness prepare={prepare} onUploaded={onUploaded} />);
    const input = screen.getByTestId("photo-upload-input");

    selectFile(input, []);

    expect(prepare).not.toHaveBeenCalled();
    expect(setCapturedImage).not.toHaveBeenCalled();
    expect(onUploaded).not.toHaveBeenCalled();
    expect(screen.getByTestId("processing")).toHaveTextContent("false");
  });

  it.each(["not-image", "decode-failed", "too-large"] as const)(
    "%s 결과면 errorKind를 노출하고 저장/콜백은 호출하지 않으며 dismissError로 닫힌다",
    async (kind) => {
      const prepare = vi.fn<Prepare>().mockResolvedValue({ ok: false, kind });
      const onUploaded = vi.fn();
      render(<Harness prepare={prepare} onUploaded={onUploaded} />);

      selectFile(screen.getByTestId("photo-upload-input"), [photo()]);

      await waitFor(() => expect(screen.getByTestId("error")).toHaveTextContent(kind));
      expect(setCapturedImage).not.toHaveBeenCalled();
      expect(onUploaded).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole("button", { name: "닫기" }));
      expect(screen.getByTestId("error")).toHaveTextContent("none");
    },
  );

  it("prepare가 예상치 못하게 throw해도 decode-failed로 처리하고 처리 중 상태를 해제한다", async () => {
    const prepare = vi.fn<Prepare>().mockRejectedValue(new Error("boom"));
    render(<Harness prepare={prepare} onUploaded={vi.fn()} />);

    selectFile(screen.getByTestId("photo-upload-input"), [photo()]);

    await waitFor(() => expect(screen.getByTestId("error")).toHaveTextContent("decode-failed"));
    expect(screen.getByTestId("processing")).toHaveTextContent("false");
  });

  it("재업로드하면 새 Blob으로 다시 setCapturedImage를 호출한다(교체)", async () => {
    const first = new Blob(["1"]);
    const second = new Blob(["2"]);
    const prepare = vi
      .fn<Prepare>()
      .mockResolvedValueOnce({ ok: true, blob: first })
      .mockResolvedValueOnce({ ok: true, blob: second });
    const onUploaded = vi.fn();
    render(<Harness prepare={prepare} onUploaded={onUploaded} />);
    const input = screen.getByTestId("photo-upload-input");

    selectFile(input, [photo("a.jpg")]);
    await waitFor(() => expect(onUploaded).toHaveBeenCalledTimes(1));
    selectFile(input, [photo("b.jpg")]);
    await waitFor(() => expect(onUploaded).toHaveBeenCalledTimes(2));

    expect(setCapturedImage).toHaveBeenNthCalledWith(1, first);
    expect(setCapturedImage).toHaveBeenNthCalledWith(2, second);
  });

  it("처리 중에는 isProcessing=true이고 openPicker 재진입을 무시한다", async () => {
    const pending = deferred<PreparePhotoResult>();
    const prepare = vi.fn<Prepare>().mockReturnValue(pending.promise);
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => undefined);
    render(<Harness prepare={prepare} onUploaded={vi.fn()} />);

    selectFile(screen.getByTestId("photo-upload-input"), [photo()]);
    await waitFor(() => expect(screen.getByTestId("processing")).toHaveTextContent("true"));

    fireEvent.click(screen.getByRole("button", { name: "열기" }));
    expect(clickSpy).not.toHaveBeenCalled();

    pending.resolve({ ok: true, blob: new Blob(["j"]) });
    await waitFor(() => expect(screen.getByTestId("processing")).toHaveTextContent("false"));

    fireEvent.click(screen.getByRole("button", { name: "열기" }));
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it("처리 중 새 선택이 오면 이전 결과는 버리고 최신 결과만 반영한다(stale 폐기)", async () => {
    const first = deferred<PreparePhotoResult>();
    const second = deferred<PreparePhotoResult>();
    const prepare = vi.fn<Prepare>().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const onUploaded = vi.fn();
    render(<Harness prepare={prepare} onUploaded={onUploaded} />);
    const input = screen.getByTestId("photo-upload-input");

    selectFile(input, [photo("old.jpg")]);
    selectFile(input, [photo("new.jpg")]);

    const newBlob = new Blob(["new"]);
    second.resolve({ ok: true, blob: newBlob });
    await waitFor(() => expect(onUploaded).toHaveBeenCalledTimes(1));

    first.resolve({ ok: true, blob: new Blob(["old"]) });
    await Promise.resolve();
    await Promise.resolve();

    expect(setCapturedImage).toHaveBeenCalledTimes(1);
    expect(setCapturedImage).toHaveBeenCalledWith(newBlob);
    expect(onUploaded).toHaveBeenCalledTimes(1);
  });

  it("언마운트 후 도착한 결과는 버린다", async () => {
    const pending = deferred<PreparePhotoResult>();
    const prepare = vi.fn<Prepare>().mockReturnValue(pending.promise);
    const onUploaded = vi.fn();
    const { unmount } = render(<Harness prepare={prepare} onUploaded={onUploaded} />);

    selectFile(screen.getByTestId("photo-upload-input"), [photo()]);
    unmount();
    pending.resolve({ ok: true, blob: new Blob(["j"]) });
    await Promise.resolve();
    await Promise.resolve();

    expect(setCapturedImage).not.toHaveBeenCalled();
    expect(onUploaded).not.toHaveBeenCalled();
  });
});
