import { useNavigate } from "react-router";
import { NavTabBar } from "../../shared/ui/nav-tab-bar/NavTabBar";

const TABS = [
  { id: "solve", label: "문제풀기" },
  { id: "mypage", label: "마이페이지" },
];

/** `/solve` 상단 탭 — `shared/ui/nav-tab-bar`를 재사용해 `/solve`/`/mypage` 전환을 연결한다. */
export function SolveNavTabs() {
  const navigate = useNavigate();

  return (
    <NavTabBar
      items={TABS}
      activeId="solve"
      onSelect={(id) => void navigate(id === "mypage" ? "/mypage" : "/solve/pencilcanvas")}
    />
  );
}
