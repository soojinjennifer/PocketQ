import { useAuthActions } from "../../features/auth/useAuthActions";
import { Logo } from "../../shared/ui/logo/Logo";
import { PagePlaceholder } from "../../shared/ui/page-placeholder/PagePlaceholder";

/** 임시 로그아웃 버튼 — 최종 디자인 아님, 테스트 편의를 위해 추가. 마이페이지 정식 구현 시 제거/교체. */
export function MyPage() {
  const { signOut } = useAuthActions();

  return (
    <div className="relative">
      <div className="absolute top-6 left-6">
        <Logo size="small" />
      </div>
      <button
        type="button"
        onClick={() => void signOut()}
        className="text-label-primary border-label-quaternary absolute top-6 right-6 rounded-[14px] border px-4 py-2 text-sm font-semibold"
      >
        로그아웃 (임시)
      </button>
      <PagePlaceholder pageName="MyPage" route="/mypage" />
    </div>
  );
}
