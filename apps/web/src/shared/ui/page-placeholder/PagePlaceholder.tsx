interface PagePlaceholderProps {
  pageName: string;
  route: string;
}

/**
 * 프론트엔드 기반 구조 + 인증 통합 단계 전용 자리표시 콘텐츠.
 * Figma 최종 UI가 아니라 라우팅/가드 동작 검증을 위한 최소 표시이며,
 * 화면마다 동일 마크업을 복사하지 않도록 공통 컴포넌트로 분리했다.
 */
export function PagePlaceholder({ pageName, route }: PagePlaceholderProps) {
  return (
    <div className="bg-bg-primary flex min-h-screen flex-col items-center justify-center gap-2 px-6 text-center">
      <p className="text-label-primary text-lg font-semibold">{pageName}</p>
      <p className="text-label-secondary text-sm">현재 라우트: {route}</p>
      <p className="text-label-tertiary text-sm">UI 구현 예정</p>
    </div>
  );
}
