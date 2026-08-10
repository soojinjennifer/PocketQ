import { useContext } from "react";
import { ProblemInputContext, type ProblemInputContextValue } from "./ProblemInputContext";

/** `/solve/pencilcanvas`, `/solve/landscape`, `/camera`, `/camera/preview` 서브트리 내부에서만 사용 가능하다. */
export function useProblemInput(): ProblemInputContextValue {
  const context = useContext(ProblemInputContext);
  if (context === undefined) {
    throw new Error("useProblemInput은 ProblemInputProvider 내부에서만 사용할 수 있습니다.");
  }
  return context;
}
