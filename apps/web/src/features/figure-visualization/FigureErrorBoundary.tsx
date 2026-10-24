import { Component, type ReactNode } from "react";

interface FigureErrorBoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
  onError?: () => void;
}

interface FigureErrorBoundaryState {
  failed: boolean;
}

/**
 * 도형 하나 단위의 오류 격리. 렌더·effect 중 예외(JSXGraph 예외, 리사이즈·단계 적용 실패)가 나면 그 도형만
 * 대체 표시로 바꾸고 다른 도형과 풀이 화면은 그대로 둔다. 언마운트로 보드 정리(freeBoard)가 실행된다.
 */
export class FigureErrorBoundary extends Component<FigureErrorBoundaryProps, FigureErrorBoundaryState> {
  override state: FigureErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): FigureErrorBoundaryState {
    return { failed: true };
  }

  override componentDidCatch(): void {
    this.props.onError?.();
  }

  override render(): ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
