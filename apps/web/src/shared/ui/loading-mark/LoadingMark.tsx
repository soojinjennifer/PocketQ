import loadingMarkSrc from "../../../assets/logo/PocketQInitial.png";

interface LoadingMarkProps {
  /** 마크의 높이 기준 px 크기(정사각형이 아닌 원본 비율을 유지하며 너비는 자동 계산됨). @default 36 */
  size?: number;
  /** 로딩 상태를 알리는 표시 텍스트. 생략하면 스크린리더용 "로딩 중" 텍스트만 시각적으로
   *  숨겨(`sr-only`) 제공한다. */
  label?: string;
}

/**
 * 포켓큐 브랜드 마크(파란색 "Q" 마스코트, Figma `190:866`)를 로딩 인디케이터로 사용하는 공용
 * 컴포넌트. 첫 풀이 로딩(문제 인식+풀이 생성)과 후속 질문(채팅) 응답 대기 중 대화 영역 끝에
 * 표시해 Claude 자체 채팅 UI처럼 진행 중임을 알린다(오너 요청).
 *
 * 투명 배경 PNG(`assets/logo/PocketQInitial.png`, 1738×2057, 배경 완전 투명) 마크만 사용한다.
 * "Q" 마스코트 색상은 PNG 안에 이미 렌더링돼 있어 별도 CSS 색상 지정이 필요 없다 — 이 파란
 * 계열 색상이 기존 디자인 토큰과 일치하는지는 별도 확인이 필요하지만(결정 필요 — 토큰 미등록
 * 가능성), 이미지 자체를 그대로 쓰므로 임의 색상 지정 문제와는 무관하다.
 *
 * 원본 이미지가 정사각형이 아니므로(가로:세로 ≈ 0.845:1) `size` prop은 "높이 기준" px로 취급하고
 * 너비는 `auto`로 두어 원본 비율을 유지한다(강제로 폭까지 `size`로 고정하면 가로로 찌그러진다).
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
        style={{ height: size, width: "auto" }}
        className="animate-[loading-mark-pulse_1.4s_ease-in-out_infinite]"
      />
      <span className={label ? "text-label-secondary text-sm" : "sr-only"}>{label ?? "로딩 중"}</span>
    </div>
  );
}
