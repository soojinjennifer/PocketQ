import type {
  Diagnosis,
  FigureSpec,
  Grade,
  RecognizedProblem,
  ResumeSolution,
  Solution,
  StepFigureRef,
  WorkLine,
} from "shared-types";

/** 검증을 통과해 SSE로 보낸 도형(Stage 5, CHAT 맥락용). */
export interface AttachedFigures {
  figures: FigureSpec[];
  stepFigureRefs: StepFigureRef[];
}

export interface StoredProblem {
  problemId: string;
  userId: string;
  grade: Grade;
  problem: RecognizedProblem;
  createdAt: string;
  /**
   * solve가 성공적으로 끝난 뒤(`done` 이벤트 시점) 채워지는 최초 풀이 결과.
   * recognize 직후에는 아직 solve가 실행되지 않았으므로 undefined다.
   * chat 핸들러가 문제/풀이 컨텍스트를 함께 조회하기 위해 존재한다(6.5B단계).
   */
  solution?: Solution;
  /** `recognizeWork`가 끝난 뒤 채워지는 줄 단위 인식 결과(WORK-2). 아직 인식 전이면 undefined. */
  workLines?: WorkLine[];
  /** `diagnose`가 끝난 뒤 채워지는 진단 결과(DIAG). 아직 진단 전이면 undefined. */
  diagnosis?: Diagnosis;
  /**
   * 진단에 실제로 쓴 줄(Stage 5 §12.2) — 학생이 확인·수정해 `diagnose` 요청 본문으로 보낸 줄. `workLines`(인식 원본)는
   * 바꾸지 않는다(resume 프롬프트·priorWork는 기존처럼 `workLines`를 쓴다). resume 결과 저장의 workContext 출처로만 쓴다.
   */
  diagnosedWorkLines?: WorkLine[];
  /** `resume`이 끝난 뒤 채워지는 이어풀기 결과(RESUME). 아직 이어풀기 전이면 undefined. */
  resumeSolution?: ResumeSolution;
}

/**
 * 서버 프로세스 메모리 내 임시 저장소.
 * Supabase 저장이 아니며, 서버 재시작 시 내용이 모두 소실된다.
 * 이번 vertical slice(1~4단계)에서 recognize→solve 사이 문제 데이터를 잠시 보관하는 용도로만 쓴다.
 */
const problems = new Map<string, StoredProblem>();
/**
 * 풀이·이어풀기 결과 객체 → 그 실행에서 보낸 도형. 결과 객체 자체(SSE done payload와 같은 객체)는 바꾸지 않는다.
 * 재풀이·재실행으로 결과 객체가 바뀌면 이전 도형은 자연히 조회되지 않는다(이전 답변의 그림을 소급 변경하지 않음).
 */
let attachedFigures = new WeakMap<object, AttachedFigures>();

function attachIfCurrent(current: object | undefined, ref: object, figures: AttachedFigures): boolean {
  if (current === undefined || current !== ref || figures.figures.length === 0) return false;
  attachedFigures.set(ref, { figures: figures.figures, stepFigureRefs: figures.stepFigureRefs });
  return true;
}

export const inMemoryProblemStore = {
  set(entry: StoredProblem): void {
    problems.set(entry.problemId, entry);
  },
  get(problemId: string): StoredProblem | undefined {
    return problems.get(problemId);
  },
  /**
   * solve가 끝난 뒤 그 결과를 기존에 저장된 문제 엔트리에 덧붙인다.
   * 대상 problemId가 저장소에 없으면(이미 소실됐거나 잘못된 id) 조용히 무시한다 —
   * solve 응답 스트림 자체(SSE)는 이미 클라이언트로 전송된 뒤이므로 여기서 실패시킬 필요가 없다.
   */
  setSolution(problemId: string, solution: Solution): void {
    const stored = problems.get(problemId);
    if (!stored) {
      return;
    }
    problems.set(problemId, { ...stored, solution });
  },
  /**
   * `recognizeWork`가 끝난 뒤 그 결과를 기존에 저장된 문제 엔트리에 덧붙인다.
   * `setSolution`과 동일한 패턴 — 대상 problemId가 저장소에 없으면 조용히 무시한다.
   */
  setWorkLines(problemId: string, workLines: WorkLine[]): void {
    const stored = problems.get(problemId);
    if (!stored) {
      return;
    }
    problems.set(problemId, { ...stored, workLines });
  },
  /**
   * `diagnose`가 끝난 뒤 그 결과를 기존에 저장된 문제 엔트리에 덧붙인다.
   * `setSolution`과 동일한 패턴 — 대상 problemId가 저장소에 없으면 조용히 무시한다.
   */
  setDiagnosis(problemId: string, diagnosis: Diagnosis): void {
    const stored = problems.get(problemId);
    if (!stored) {
      return;
    }
    problems.set(problemId, { ...stored, diagnosis });
  },
  /** `diagnose`가 진단에 쓴 줄을 덧붙인다(Stage 5 §12.2). 대상이 없으면 조용히 무시한다. */
  setDiagnosedWorkLines(problemId: string, diagnosedWorkLines: WorkLine[]): void {
    const stored = problems.get(problemId);
    if (!stored) {
      return;
    }
    problems.set(problemId, { ...stored, diagnosedWorkLines });
  },
  /**
   * `resume`이 끝난 뒤 그 결과를 기존에 저장된 문제 엔트리에 덧붙인다.
   * `setDiagnosis`와 동일한 패턴 — 대상 problemId가 저장소에 없으면 조용히 무시한다.
   */
  setResumeSolution(problemId: string, resumeSolution: ResumeSolution): void {
    const stored = problems.get(problemId);
    if (!stored) {
      return;
    }
    problems.set(problemId, { ...stored, resumeSolution });
  },
  /**
   * 도형 단계가 끝난 뒤 수용 도형을 풀이에 연결한다(Stage 5, `FIGURES_ENABLED`만으로 — 영속 플래그와 무관, CHAT용).
   * 저장된 `solution`이 `solvedRef`와 **같은 객체**일 때만 연결한다 — 그 사이 재풀이됐으면 무시하고 false.
   */
  attachSolutionFigures(problemId: string, solvedRef: Solution, figures: AttachedFigures): boolean {
    return attachIfCurrent(problems.get(problemId)?.solution, solvedRef, figures);
  },
  /** `attachSolutionFigures`와 같은 규칙(저장된 `resumeSolution`이 `resumedRef`와 같은 객체일 때만). */
  attachResumeFigures(problemId: string, resumedRef: ResumeSolution, figures: AttachedFigures): boolean {
    return attachIfCurrent(problems.get(problemId)?.resumeSolution, resumedRef, figures);
  },
  /** 현재 저장된 `solution`에 연결된 도형. 없으면 undefined. */
  getSolutionFigures(problemId: string): AttachedFigures | undefined {
    const solution = problems.get(problemId)?.solution;
    return solution ? attachedFigures.get(solution) : undefined;
  },
  /** 현재 저장된 `resumeSolution`에 연결된 도형. 없으면 undefined. */
  getResumeFigures(problemId: string): AttachedFigures | undefined {
    const resumeSolution = problems.get(problemId)?.resumeSolution;
    return resumeSolution ? attachedFigures.get(resumeSolution) : undefined;
  },
  clear(): void {
    problems.clear();
    attachedFigures = new WeakMap<object, AttachedFigures>();
  },
};
