import { describe, expect, it, vi } from "vitest";
import {
  computeTargetSize,
  reencodeImageToJpeg,
  ReencodeImageError,
  type DecodedImage,
  type EncodeSurface,
  type ReencodeImageDeps,
} from "./reencodeImageToJpeg";

function createHarness(options: {
  width: number;
  height: number;
  decodeError?: Error;
  hasContext?: boolean;
  blobResult?: Blob | null;
}) {
  const calls: string[] = [];
  const close = vi.fn();
  const fillRect = vi.fn(() => calls.push("fillRect"));
  const drawImage = vi.fn(() => calls.push("drawImage"));
  const context = { fillStyle: "", fillRect, drawImage };
  const toBlob = vi.fn((callback: BlobCallback) =>
    callback(options.blobResult === undefined ? new Blob(["jpeg"], { type: "image/jpeg" }) : options.blobResult),
  );
  const surface: EncodeSurface = {
    width: 0,
    height: 0,
    getContext: () => (options.hasContext === false ? null : context),
    toBlob,
  };
  const createCanvas = vi.fn((width: number, height: number) => {
    surface.width = width;
    surface.height = height;
    return surface;
  });
  const source = {} as CanvasImageSource;
  const decoded: DecodedImage = { width: options.width, height: options.height, source, close };
  const decode = vi.fn(() =>
    options.decodeError ? Promise.reject(options.decodeError) : Promise.resolve(decoded),
  );
  const deps: ReencodeImageDeps = { decode, createCanvas };
  return { deps, decode, createCanvas, context, fillRect, drawImage, toBlob, close, calls, source };
}

describe("computeTargetSize", () => {
  it("긴 변이 상한 이하이면 확대 없이 원본 크기를 유지한다", () => {
    expect(computeTargetSize(800, 600, 1568)).toEqual({ width: 800, height: 600 });
    expect(computeTargetSize(1568, 100, 1568)).toEqual({ width: 1568, height: 100 });
  });

  it("긴 변이 상한을 넘으면 종횡비를 유지한 채 긴 변을 상한에 맞춘다", () => {
    expect(computeTargetSize(3136, 1568, 1568)).toEqual({ width: 1568, height: 784 });
    expect(computeTargetSize(1000, 4000, 1568)).toEqual({ width: 392, height: 1568 });
  });

  it("극단적인 종횡비에서도 짧은 변이 0이 되지 않는다", () => {
    expect(computeTargetSize(100000, 10, 1568).height).toBe(1);
  });
});

describe("reencodeImageToJpeg", () => {
  it("큰 이미지를 긴 변 1568로 축소해 JPEG(0.92)로 인코딩한다", async () => {
    const harness = createHarness({ width: 3136, height: 2352 });

    const result = await reencodeImageToJpeg(new Blob(["x"]), undefined, harness.deps);

    expect(harness.createCanvas).toHaveBeenCalledWith(1568, 1176);
    expect(harness.drawImage).toHaveBeenCalledWith(harness.source, 0, 0, 1568, 1176);
    expect(harness.toBlob).toHaveBeenCalledWith(expect.any(Function), "image/jpeg", 0.92);
    expect(result.type).toBe("image/jpeg");
  });

  it("작은 이미지도 확대하지 않고 항상 JPEG로 다시 인코딩한다", async () => {
    const harness = createHarness({ width: 400, height: 300 });

    await reencodeImageToJpeg(new Blob(["x"], { type: "image/png" }), 1568, harness.deps);

    expect(harness.createCanvas).toHaveBeenCalledWith(400, 300);
    expect(harness.toBlob).toHaveBeenCalledTimes(1);
  });

  it("maxDimension 인자로 상한을 바꿀 수 있다", async () => {
    const harness = createHarness({ width: 1000, height: 500 });

    await reencodeImageToJpeg(new Blob(["x"]), 500, harness.deps);

    expect(harness.createCanvas).toHaveBeenCalledWith(500, 250);
  });

  it("이미지를 그리기 전에 흰 배경을 먼저 채운다(투명 PNG가 검정이 되는 것 방지)", async () => {
    const harness = createHarness({ width: 100, height: 100 });

    await reencodeImageToJpeg(new Blob(["x"]), 1568, harness.deps);

    expect(harness.context.fillStyle).toBe("#ffffff");
    expect(harness.fillRect).toHaveBeenCalledWith(0, 0, 100, 100);
    expect(harness.calls).toEqual(["fillRect", "drawImage"]);
  });

  it("성공/실패와 관계없이 디코딩 리소스를 해제한다", async () => {
    const success = createHarness({ width: 100, height: 100 });
    await reencodeImageToJpeg(new Blob(["x"]), 1568, success.deps);
    expect(success.close).toHaveBeenCalledTimes(1);

    const failure = createHarness({ width: 100, height: 100, blobResult: null });
    await expect(reencodeImageToJpeg(new Blob(["x"]), 1568, failure.deps)).rejects.toBeInstanceOf(
      ReencodeImageError,
    );
    expect(failure.close).toHaveBeenCalledTimes(1);
  });

  it("디코딩이 실패하면 kind='decode-failed' 에러를 던진다", async () => {
    const harness = createHarness({ width: 0, height: 0, decodeError: new Error("bad") });

    await expect(reencodeImageToJpeg(new Blob(["x"]), 1568, harness.deps)).rejects.toMatchObject({
      name: "ReencodeImageError",
      kind: "decode-failed",
    });
    expect(harness.createCanvas).not.toHaveBeenCalled();
  });

  it("디코딩된 크기가 0이면 kind='decode-failed'로 처리하고 리소스를 해제한다", async () => {
    const harness = createHarness({ width: 0, height: 100 });

    await expect(reencodeImageToJpeg(new Blob(["x"]), 1568, harness.deps)).rejects.toMatchObject({
      kind: "decode-failed",
    });
    expect(harness.close).toHaveBeenCalledTimes(1);
  });

  it("toBlob이 null이면 kind='encode-failed' 에러를 던진다", async () => {
    const harness = createHarness({ width: 100, height: 100, blobResult: null });

    await expect(reencodeImageToJpeg(new Blob(["x"]), 1568, harness.deps)).rejects.toMatchObject({
      kind: "encode-failed",
    });
  });

  it("2D 컨텍스트를 얻지 못하면 kind='encode-failed' 에러를 던진다", async () => {
    const harness = createHarness({ width: 100, height: 100, hasContext: false });

    await expect(reencodeImageToJpeg(new Blob(["x"]), 1568, harness.deps)).rejects.toMatchObject({
      kind: "encode-failed",
    });
  });
});
