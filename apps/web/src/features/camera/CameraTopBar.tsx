import { useNavigate } from "react-router";

interface CameraTopBarProps {
  title: string;
}

/**
 * Figma `Camera/Top Bar`(node `48:110` 내부) — `/camera`, `/camera/preview` 공유 상단 바.
 * 좌측 "취소" 클릭 시 촬영 흐름을 벗어나 `/solve`로 복귀한다.
 */
export function CameraTopBar({ title }: CameraTopBarProps) {
  const navigate = useNavigate();

  return (
    <div className="relative flex items-center justify-center px-5 py-4">
      <button
        type="button"
        onClick={() => void navigate("/solve")}
        className="text-label-on-dark absolute left-5 text-[16px]"
      >
        취소
      </button>
      <p className="text-label-on-dark-secondary text-[13px] font-semibold">{title}</p>
    </div>
  );
}
