import type { Grade, RecognizedProblem } from "shared-types";

export interface StoredProblem {
  problemId: string;
  userId: string;
  grade: Grade;
  problem: RecognizedProblem;
  createdAt: string;
}

/**
 * 서버 프로세스 메모리 내 임시 저장소.
 * Supabase 저장이 아니며, 서버 재시작 시 내용이 모두 소실된다.
 * 이번 vertical slice(1~4단계)에서 recognize→solve 사이 문제 데이터를 잠시 보관하는 용도로만 쓴다.
 */
const problems = new Map<string, StoredProblem>();

export const inMemoryProblemStore = {
  set(entry: StoredProblem): void {
    problems.set(entry.problemId, entry);
  },
  get(problemId: string): StoredProblem | undefined {
    return problems.get(problemId);
  },
  clear(): void {
    problems.clear();
  },
};
