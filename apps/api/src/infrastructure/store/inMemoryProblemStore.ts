import type { Grade, RecognizedProblem, Solution } from "shared-types";

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
  clear(): void {
    problems.clear();
  },
};
