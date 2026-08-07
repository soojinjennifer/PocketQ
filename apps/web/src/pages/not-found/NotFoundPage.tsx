import { Link } from "react-router";

export function NotFoundPage() {
  return (
    <div className="bg-bg-primary flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-label-primary text-lg font-semibold">페이지를 찾을 수 없습니다</p>
      <Link to="/solve/pencilcanvas" className="text-brand text-sm underline">
        문제 풀기로 이동
      </Link>
    </div>
  );
}
