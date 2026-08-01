export interface NavTabBarItem {
  id: string;
  label: string;
}

interface NavTabBarProps {
  items: NavTabBarItem[];
  activeId: string;
  onSelect: (id: string) => void;
}

/**
 * 탭 전환 pill (Figma `get_design_context` 실측 스타일 그대로 적용).
 * 로그인/회원가입 전환에서 우선 사용하며, 문제풀기/마이페이지 하단 탭 등
 * 다른 화면에서도 재사용할 수 있도록 범용 props로 구현했다.
 */
export function NavTabBar({ items, activeId, onSelect }: NavTabBarProps) {
  return (
    <div className="relative flex gap-[2px] rounded-full border border-[var(--color-glass-border)] p-[4px] drop-shadow-[0px_7px_6.5px_rgba(35,43,56,0.11),0px_2px_0px_rgba(35,43,56,0.18)]">
      <div className="absolute inset-0 rounded-full bg-[var(--color-glass-fill)]" />
      {items.map((item) => {
        const isActive = item.id === activeId;
        return (
          <button
            key={item.id}
            type="button"
            aria-pressed={isActive}
            onClick={() => onSelect(item.id)}
            className={
              isActive
                ? "relative rounded-full bg-[var(--color-brand)] px-[18px] py-[7px] text-[15px] font-semibold text-[var(--color-bg-elevated)]"
                : "relative rounded-full px-[18px] py-[7px] text-[15px] font-semibold text-[var(--color-label-secondary)]"
            }
          >
            {item.label}
          </button>
        );
      })}
      <div className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-[inset_0px_2px_0px_0px_rgba(255,255,255,0.6)]" />
    </div>
  );
}
