/**
 * 도형 렌더 실패 시 대체 표시 — `docs/FIGURE_DESIGN.md` §8.
 * 보드 상자와 같은 상자에 안내 문구 한 줄. 아이콘·기술 문구·라이브 영역은 쓰지 않는다.
 * 설명(description)은 `FigureView`의 figcaption이 성공 시와 같은 자리에 그대로 보여 준다.
 */
export const FIGURE_FALLBACK_MESSAGE = "그림을 표시하지 못했어요. 아래 설명을 참고해 주세요.";

export function FigureFallback() {
  return (
    <div className="bg-bg-canvas border-separator rounded-[10px] border p-4">
      <p className="text-label-primary text-[13px] leading-[18px] font-[590] wrap-anywhere">{FIGURE_FALLBACK_MESSAGE}</p>
    </div>
  );
}
