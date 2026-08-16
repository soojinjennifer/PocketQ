import { Button } from "../../shared/ui/button/Button";

interface ProfileHeaderCardProps {
  /** 표시할 이름. 닉네임이 없으면 호출 측이 대체 문구를 넣어 전달한다. */
  name: string;
  /** 이름 아래 부제(학년 · 이메일). 값이 없으면 렌더링하지 않는다. */
  subtitle?: string;
  onChangeGrade: () => void;
  onSignOut: () => void;
}

/**
 * Figma `4 · MyPage` 프로필 헤더 카드(node `40:46`) 실측 스타일 — 아바타 원(52px, 이름 첫 글자) +
 * 이름/부제 + 우측 `학년 변경`(`Button variant="select"`)/`로그아웃`(`variant="logout"`).
 *
 * 인증 상태는 이 컴포넌트가 직접 조회하지 않고 상위(페이지 레이어)에서 props로 주입받는다.
 * `features/learning-history`가 `features/auth`를 직접 참조하면 feature 간 직접 참조를 금지하는
 * `.claude/rules/frontend.md` §1을 위반하기 때문이다(`ProblemInputProvider`가 `grade`를 상위에서
 * 주입받는 것과 동일한 패턴).
 */
export function ProfileHeaderCard({
  name,
  subtitle,
  onChangeGrade,
  onSignOut,
}: ProfileHeaderCardProps) {
  // 아바타는 이름 첫 글자만 쓴다(Figma 실측). 이름이 비어 있을 일은 없지만 방어적으로 처리한다.
  const initial = name.trim().charAt(0) || "?";

  return (
    <section className="bg-bg-elevated flex flex-wrap items-center gap-[14px] rounded-[16px] px-[18px] py-[16px]">
      <span
        aria-hidden="true"
        className="bg-brand text-label-on-dark flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full text-[22px] font-bold"
      >
        {initial}
      </span>

      <div className="flex min-w-0 flex-1 flex-col">
        <p className="text-label-primary truncate text-[17px] font-[590]">{name}</p>
        {subtitle ? (
          <p className="text-label-secondary truncate text-[15px] font-normal">{subtitle}</p>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Button variant="select" onClick={onChangeGrade}>
          학년 변경
        </Button>
        <Button variant="logout" onClick={onSignOut}>
          로그아웃
        </Button>
      </div>
    </section>
  );
}
