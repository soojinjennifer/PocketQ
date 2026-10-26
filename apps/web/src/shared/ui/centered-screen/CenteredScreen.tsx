import type { ReactNode } from "react";

interface CenteredScreenProps {
  children: ReactNode;
}

/**
 * 로고·제목·짧은 폼을 화면 가운데에 세우는 전체 화면 레이아웃(`docs/SIGNUP_CONSENT_DESIGN.md` §1, D9).
 * Login·Register·GradeSetup 루트 `div`와 같은 배치를 공통화했고, iOS Safari 큰 뷰포트 문제를 피하려
 * `min-h-screen` 대신 `min-h-dvh`를 쓴다(frontend.md §3-6). `py-6`은 콘텐츠가 뷰포트보다 길 때
 * 위아래 가장자리에 붙지 않게 하고, `break-keep`은 한글 어절 중간 줄바꿈을 막는다.
 *
 * 폭과 내부 간격은 사용하는 쪽이 정한다. 현재는 가입 동의 게이트만 쓰며, 기존 3개 화면 이전은 후속 작업이다.
 */
export function CenteredScreen({ children }: CenteredScreenProps) {
  return (
    <main className="bg-bg-primary flex min-h-dvh flex-col items-center justify-center gap-6 px-6 py-6 break-keep">
      {children}
    </main>
  );
}
