import { describe, expect, it, vi } from "vitest";
import type { Stroke } from "../../shared/lib/canvas/useDrawingStrokes";
import { normalizeProblemInput } from "./normalizeProblemInput";

const STROKE: Stroke = { tool: "pen", points: [{ x: 0, y: 0, pressure: 0.5 }] };

describe("normalizeProblemInput", () => {
  it("사진이 있으면 필기 획이 있어도 사진을 우선 사용한다(오너 확정 우선순위)", async () => {
    const photoBlob = new Blob(["photo"], { type: "image/jpeg" });
    const exportStrokes = vi.fn();

    const result = await normalizeProblemInput({
      photoBlob,
      strokes: [STROKE],
      grade: "M2",
      exportStrokes,
    });

    expect(result).toEqual({ inputType: "photo", imageBlob: photoBlob, grade: "M2" });
    expect(exportStrokes).not.toHaveBeenCalled();
  });

  it("사진이 없고 필기 획만 있으면 exportStrokes로 PNG Blob을 만들어 handwriting으로 정규화한다", async () => {
    const exportedBlob = new Blob(["png"], { type: "image/png" });
    const exportStrokes = vi.fn().mockResolvedValue(exportedBlob);

    const result = await normalizeProblemInput({
      photoBlob: null,
      strokes: [STROKE],
      grade: "H1",
      exportStrokes,
    });

    expect(exportStrokes).toHaveBeenCalledWith([STROKE]);
    expect(result).toEqual({ inputType: "handwriting", imageBlob: exportedBlob, grade: "H1" });
  });

  it("사진도 필기 획도 없으면 null을 반환하고 exportStrokes를 호출하지 않는다", async () => {
    const exportStrokes = vi.fn();

    const result = await normalizeProblemInput({
      photoBlob: null,
      strokes: [],
      grade: "M2",
      exportStrokes,
    });

    expect(result).toBeNull();
    expect(exportStrokes).not.toHaveBeenCalled();
  });

  it("exportStrokes가 null을 반환하면(예: 빈 획) 전체 결과도 null이다", async () => {
    const exportStrokes = vi.fn().mockResolvedValue(null);

    const result = await normalizeProblemInput({
      photoBlob: null,
      strokes: [STROKE],
      grade: "M2",
      exportStrokes,
    });

    expect(result).toBeNull();
  });
});
