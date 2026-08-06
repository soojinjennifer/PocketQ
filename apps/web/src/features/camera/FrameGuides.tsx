interface CornerProps {
  className: string;
}

const CORNER_SIZE_CLASS = "size-[34px]";
const CORNER_THICKNESS_CLASS = "border-[2.5px]";

function Corner({ className }: CornerProps) {
  return (
    <div
      aria-hidden="true"
      className={`border-accent-yellow pointer-events-none absolute ${CORNER_THICKNESS_CLASS} ${CORNER_SIZE_CLASS} ${className}`}
    />
  );
}

/**
 * Figma `Camera/Frame Guides`(node `48:110` 내부) — 촬영 화면에만 표시되는 모서리 코너 브래킷 4개.
 * `/camera/preview`에는 렌더링하지 않는다.
 */
export function FrameGuides() {
  return (
    <div className="pointer-events-none absolute inset-0">
      <Corner className="top-4 left-4 border-r-0 border-b-0" />
      <Corner className="top-4 right-4 border-b-0 border-l-0" />
      <Corner className="bottom-4 left-4 border-t-0 border-r-0" />
      <Corner className="right-4 bottom-4 border-t-0 border-l-0" />
    </div>
  );
}
