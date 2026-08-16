import loadingMarkSrc from "../../../assets/logo/WhyMathInitial.png";

interface LoadingMarkProps {
  /** 마크 한 변의 px 크기. @default 36 */
  size?: number;
  /** 로딩 상태를 알리는 표시 텍스트. 생략하면 스크린리더용 "로딩 중" 텍스트만 시각적으로
   *  숨겨(`sr-only`) 제공한다. */
  label?: string;
}

/**
 * 왜수학 브랜드 마크("M", Figma `190:866`)를 로딩 인디케이터로 사용하는 공용 컴포넌트.
 * 첫 풀이 로딩(문제 인식+풀이 생성)과 후속 질문(채팅) 응답 대기 중 대화 영역 끝에 표시해
 * Claude 자체 채팅 UI처럼 진행 중임을 알린다(오너 요청).
 *
 * 배경 없이 투명 배경 PNG(`assets/logo/WhyMathInitial.png`) 마크만 사용한다 — 원본 Figma
 * 노드의 배경 사각형(`#f5f5f5`)은 이번 로딩 인디케이터에 쓰지 않는다(오너 확정). M 글리프 색상
 * (`#6a8891`)은 PNG 안에 이미 렌더링돼 있어 별도 CSS 색상 지정이 필요 없다 — 두 색상 모두
 * 기존 디자인 토큰과 일치하지 않는 것이 design-agent 확인으로 이미 파악됐지만, 이미지 자체를
 * 그대로 쓰므로 임의 색상 지정 문제와는 무관하다.
 *
 * 펄스 애니메이션(`loading-mark-pulse`, `shared/styles/global.css`)은 Figma에 정의돼 있지
 * 않아(design-agent 확인 완료) opacity 0.4~1.0 / scale 0.92~1.0, 1.4s 주기를 임시값으로
 * 쓴다(결정 필요 — 오너 확인 후 조정 가능). `result-panel-slide-in`(마운트 1회 재생)과 달리
 * 로딩이 계속되는 동안 반복 재생돼야 하므로 `infinite`를 명시한다.
 *
 * 아이콘 자체는 장식용이라 `alt=""`로 두고, 접근성 텍스트는 `role="status" aria-live="polite"`
 * 컨테이너 안의 별도 텍스트(`label` prop 또는 `sr-only` 기본 문구)로 제공한다.
 */
export function LoadingMark({ size = 36, label }: LoadingMarkProps) {
  return (
    <div role="status" aria-live="polite" className="inline-flex items-center gap-2">
      <img
        src={loadingMarkSrc}
        alt=""
        style={{ width: size, height: size }}
        className="animate-[loading-mark-pulse_1.4s_ease-in-out_infinite]"
      />
      <span className={label ? "text-label-secondary text-sm" : "sr-only"}>{label ?? "로딩 중"}</span>
    </div>
  );
}
