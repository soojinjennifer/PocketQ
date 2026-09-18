import { useNavigate } from "react-router";

/**
 * Figma `Pen Rail`(node `42:159`) 하위 "사진" 슬롯이 `Pen Rail`에서 독립 컴포넌트로 분리됐다
 * (오너 UX 결정: `Pen Rail`은 펜/지우개/Undo/Redo/전체삭제 5버튼으로 재구성하고, 카메라 진입은
 * 별도 원형 버튼으로 뺀다). `/camera`로 이동시키는 로직만 그대로 옮겨왔다 — 순수 컴포넌트로
 * 내부 상태를 갖지 않는다.
 *
 * 배치는 이 컴포넌트를 쓰는 페이지(`SolvePencilcanvasPage`/`SolveLandscapePage`)가 `Pen Rail`
 * 바로 위에 동일한 툴 컬럼 컨테이너 안에 넣어 담당한다.
 */
export function CameraRailButton() {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      aria-label="사진"
      onClick={() => void navigate("/camera")}
      className={
        "border-separator bg-glass-fill flex size-[52px] items-center justify-center rounded-full border " +
        "drop-shadow-[0px_3px_0px_rgba(35,43,56,0.21),0px_8px_16px_rgba(35,43,56,0.14),0px_20px_34px_rgba(35,43,56,0.08)] " +
        "shadow-[inset_0px_2px_0px_rgba(255,255,255,0.9),inset_0px_-2px_0px_rgba(35,43,56,0.07)]"
      }
    >
      <span className="bg-fill-tint-brand text-icon-default flex size-[32px] items-center justify-center rounded-full">
        <svg viewBox="0 0 18 18" fill="none" className="size-[18px]" aria-hidden="true">
          <path
            fill="currentColor"
            d="M9 7.5L8.295 9.045L6.75 9.75L8.295 10.455L9 12L9.705 10.455L11.25 9.75L9.705 9.045L9 7.5ZM15 3.75H12.6225L11.25 2.25H6.75L5.3775 3.75H3C2.175 3.75 1.5 4.425 1.5 5.25V14.25C1.5 15.075 2.175 15.75 3 15.75H15C15.825 15.75 16.5 15.075 16.5 14.25V5.25C16.5 4.425 15.825 3.75 15 3.75ZM15 14.25H3V5.25H6.0375L6.48 4.7625L7.41 3.75H10.59L11.52 4.7625L11.9625 5.25H15V14.25ZM9 6C6.93 6 5.25 7.68 5.25 9.75C5.25 11.82 6.93 13.5 9 13.5C11.07 13.5 12.75 11.82 12.75 9.75C12.75 7.68 11.07 6 9 6ZM9 12C7.7625 12 6.75 10.9875 6.75 9.75C6.75 8.5125 7.7625 7.5 9 7.5C10.2375 7.5 11.25 8.5125 11.25 9.75C11.25 10.9875 10.2375 12 9 12Z"
          />
        </svg>
      </span>
    </button>
  );
}
