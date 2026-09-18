import { Modal } from "../../shared/ui/modal/Modal";

interface RecognizedProblemPopupProps {
  recognizedText: string | null;
  onContinue: () => void;
  /**
   * "인식취소" 버튼 클릭 핸들러(오너 UX 결정: 인식취소 상시 배치, 사진 인식 직후 확인 팝업에도
   * 취소 옵션 추가). `useProblemInput()`의 `cancelRecognition`을 그대로 전달받아 INPUT 단계로
   * 완전히 되돌린다 — "다시 찍기"라는 라벨은 실제로 카메라를 재호출하지 않고 인식 자체를 취소해
   * 빈 INPUT으로 돌아가는 이 동작과 맞지 않을 수 있어(오너 판단 필요 항목이었음), 같은 화면의 다른
   * 에러 팝업(`SolvePencilcanvasPage`)이 이미 쓰고 있는 "인식취소" 문구로 통일했다.
   */
  onCancelRecognition: () => void;
}

/**
 * 사진으로 문제를 인식한 직후(WORK 단계 전환 전) 보여주는 확인 팝업(Figma 신규, 오너 승인).
 * 필기 입력에는 이 팝업이 없다 — 아래 캡션("촬영한 문제")이 사진 전제로 고정돼 있고, Figma에도
 * 필기 전용 variant가 없다(`SolvePencilcanvasPage`의 `handleRecognize`가 사진 입력일 때만 이
 * 컴포넌트를 띄운다).
 *
 * `Modal`의 `wide`/`content` 슬롯을 사용해 조립한다 — 새 팝업 마크업을 만들지 않고 기존 `Modal`의
 * 제목/버튼 마크업을 그대로 재사용한다. 미리보기 카드는 Figma `Solve/Problem Card` 인스턴스를
 * 참고하되 콘텐츠가 텍스트라 `ProblemCard.tsx`와는 별개 마크업이다 — 그림자만 동일 리터럴
 * (`Elevation/Photo Card`)을 그대로 복사해서 재사용한다.
 *
 * `recognizedText`는 `RecognizedChip`/`RecognizedProblemBar`와 동일하게 원문을 그대로 보여준다
 * (두 컴포넌트 모두 `renderMathText`를 쓰지 않으므로 동일 패턴을 따른다).
 */
export function RecognizedProblemPopup({
  recognizedText,
  onContinue,
  onCancelRecognition,
}: RecognizedProblemPopupProps) {
  return (
    <Modal
      wide
      title="문제가 인식 되었습니다"
      actionLabel="계속하기"
      onAction={onContinue}
      cancelLabel="인식취소"
      onCancel={onCancelRecognition}
      content={
        <div className="bg-bg-elevated max-h-[50vh] w-[540px] max-w-full overflow-y-auto rounded-[6px] px-[30px] py-[26px] drop-shadow-[0px_3px_0px_rgba(35,43,56,0.16),0px_10px_20px_rgba(35,43,56,0.14),0px_22px_40px_rgba(35,43,56,0.09)]">
          <p className="text-label-tertiary text-[12px] leading-[16px]">촬영한 문제</p>
          <p className="text-label-primary mt-2 text-[20px] leading-[25px] font-[590] whitespace-pre-wrap">
            {recognizedText}
          </p>
        </div>
      }
    />
  );
}
