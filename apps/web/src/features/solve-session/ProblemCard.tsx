/**
 * `ProblemCard`가 받을 수 있는 3가지 상태.
 * - `{ imageUrl }`: 촬영된 사진을 그대로 보여준다(오너 확정 사양).
 * - `{ recognitionFailed: true }`: 향후 OCR 연동 시를 대비한 자리 — 이번 단계에서 실제로
 *   트리거하는 로직은 없다.
 * - `null`: 아직 사진을 찍지 않은 초기 상태.
 */
export type ProblemCardData = { imageUrl: string } | { recognitionFailed: true } | null;

interface ProblemCardProps {
  data: ProblemCardData;
}

/** Figma `Problem Card`(node `38:30`) — `/solve` 문제 입력 카드. */
export function ProblemCard({ data }: ProblemCardProps) {
  return (
    <div className="bg-bg-elevated flex min-h-[220px] w-full flex-col gap-3 rounded-[6px] p-5 drop-shadow-[0px_3px_0px_rgba(35,43,56,0.16),0px_10px_20px_rgba(35,43,56,0.14),0px_22px_40px_rgba(35,43,56,0.09)]">
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
      ) : (
        <img
          src={data.imageUrl}
          alt="촬영한 문제"
          className="max-h-[400px] w-full rounded-[4px] object-contain"
        />
      )}
    </div>
  );
}
