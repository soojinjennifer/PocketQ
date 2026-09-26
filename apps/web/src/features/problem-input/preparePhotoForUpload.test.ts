import { describe, expect, it, vi } from "vitest";
import { MAX_UPLOAD_BYTES, preparePhotoForUpload } from "./preparePhotoForUpload";

function file(name: string, type: string): File {
  return new File(["x"], name, { type });
}

describe("preparePhotoForUpload", () => {
  it("이미지면 정규화한 JPEG Blob을 돌려준다", async () => {
    const jpeg = new Blob(["jpeg"], { type: "image/jpeg" });
    const reencode = vi.fn().mockResolvedValue(jpeg);
    const input = file("a.png", "image/png");

    const result = await preparePhotoForUpload(input, { reencode });

    expect(reencode).toHaveBeenCalledWith(input);
    expect(result).toEqual({ ok: true, blob: jpeg });
  });

  it("type이 비어 있어도 heic/heif 확장자면 이미지로 취급한다(대소문자 무시)", async () => {
    const reencode = vi.fn().mockResolvedValue(new Blob(["j"]));

    expect((await preparePhotoForUpload(file("IMG_1.HEIC", ""), { reencode })).ok).toBe(true);
    expect((await preparePhotoForUpload(file("IMG_2.heif", ""), { reencode })).ok).toBe(true);
  });

  it("이미지가 아니면 not-image이며 정규화를 시도하지 않는다", async () => {
    const reencode = vi.fn();

    const result = await preparePhotoForUpload(file("doc.pdf", "application/pdf"), { reencode });

    expect(result).toEqual({ ok: false, kind: "not-image" });
    expect(reencode).not.toHaveBeenCalled();
  });

  it("정규화가 실패하면 decode-failed", async () => {
    const reencode = vi.fn().mockRejectedValue(new Error("bad"));

    const result = await preparePhotoForUpload(file("a.jpg", "image/jpeg"), { reencode });

    expect(result).toEqual({ ok: false, kind: "decode-failed" });
  });

  it("정규화 후 5MB를 넘으면 too-large, 정확히 5MB면 통과한다", async () => {
    const over = { size: MAX_UPLOAD_BYTES + 1 } as Blob;
    const exact = { size: MAX_UPLOAD_BYTES } as Blob;

    expect(
      await preparePhotoForUpload(file("a.jpg", "image/jpeg"), { reencode: () => Promise.resolve(over) }),
    ).toEqual({ ok: false, kind: "too-large" });
    expect(
      (await preparePhotoForUpload(file("a.jpg", "image/jpeg"), { reencode: () => Promise.resolve(exact) })).ok,
    ).toBe(true);
  });

  it("원본이 커도 사전 크기 상한은 없다(정규화 결과만 검사한다)", async () => {
    const big = new File([new Uint8Array(1024)], "big.jpg", { type: "image/jpeg" });
    Object.defineProperty(big, "size", { value: 50 * 1024 * 1024 });
    const small = new Blob(["s"]);

    const result = await preparePhotoForUpload(big, { reencode: () => Promise.resolve(small) });

    expect(result).toEqual({ ok: true, blob: small });
  });
});
