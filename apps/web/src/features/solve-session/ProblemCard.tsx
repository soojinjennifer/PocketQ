/**
 * `ProblemCard`가 받을 수 있는 4가지 상태.
 * - `{ imageUrl }`: 촬영된 사진을 그대로 보여준다(오너 확정 사양).
 * - `{ recognitionFailed: true }`: 향후 OCR 연동 시를 대비한 자리 — 이번 단계에서 실제로
 *   트리거하는 로직은 없다.
 * - `{ needsRetake: true }`: 결과 화면에서 "수정"(다시 입력)을 눌렀고 원래 입력이 사진이었을 때 —
 *   사진 Blob은 이미 지워진 상태라(풀이 성공 시 자동 정리) 다시 찍어야 한다는 안내만 보여준다.
 * - `null`: 아직 사진을 찍지 않은 초기 상태.
 */
export type ProblemCardData =
  | { imageUrl: string }
  | { recognitionFailed: true }
  | { needsRetake: true }
  | null;

interface ProblemCardProps {
  data: ProblemCardData;
  /** `data`가 `{ needsRetake: true }`일 때만 쓰인다 — 카드를 눌러 `/camera`로 이동한다. */
  onRequestRetake?: () => void;
}

/** Figma `Problem Card`(node `38:30`) — `/solve` 문제 입력 카드. */
export function ProblemCard({ data, onRequestRetake }: ProblemCardProps) {
  return (
    <div className="bg-bg-elevated flex min-h-[110px] w-full flex-col gap-3 rounded-[6px] p-5 drop-shadow-[0px_3px_0px_rgba(35,43,56,0.16),0px_10px_20px_rgba(35,43,56,0.14),0px_22px_40px_rgba(35,43,56,0.09)]">
      <p className="text-label-tertiary text-xs font-semibold">문제</p>
      {data === null ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-label-tertiary text-center text-[15px]">
            사진을 찍어 문제를 입력해 주세요
          </p>
        </div>
      ) : "recognitionFailed" in data ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-label-primary text-center text-[20px]">문제가 인식되지 않았습니다</p>
        </div>
      ) : "needsRetake" in data ? (
        // 디자인 시스템에 빨간 계열 토큰이 없어(docs/DESIGN_TOKEN_MAP.md 확인) 기존 경고색
        // (accent/orange, Modal 에러 아이콘과 동일 톤)으로 대체했다 — 결정 필요(정확한 빨간색이
        // 필요하면 Figma 실측 후 토큰 추가 필요).
        <button
          type="button"
          onClick={onRequestRetake}
          className="flex flex-1 flex-col items-center justify-center gap-1"
        >
          <p className="text-label-tertiary text-center text-[15px]">
            사진을 찍어 문제를 입력해 주세요
          </p>
          <p className="text-accent-orange text-center text-[13px] font-semibold">
            문제를 다시 찍어 주세요
          </p>
        </button>
      ) : (
        <img
          src={data.imageUrl}
          alt="촬영한 문제"
          className="max-h-[200px] w-full rounded-[4px] object-contain"
        />
      )}
    </div>
  );
}
