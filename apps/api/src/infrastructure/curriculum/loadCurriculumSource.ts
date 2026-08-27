import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { curriculumSourceSchema, type CurriculumSource } from "./curriculumSourceSchema";
import { validateCurriculumGraph, type CurriculumGraphValidationResult } from "./validateCurriculumGraph";

// apps/api/src/infrastructure/curriculum(빌드 후에는 apps/api/dist/infrastructure/curriculum,
// 둘 다 저장소 루트에서 같은 깊이라 동일한 상대경로로 계산된다)에서 저장소 루트까지 5단계.
const CURRENT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(CURRENT_DIR, "../../../../..");

/** 저장소 루트 기준 상대경로를 절대경로로 변환한다. */
export function resolveRepoPath(relativePath: string): string {
  return path.resolve(REPO_ROOT, relativePath);
}

/** `data/math-curriculum/*.v1.json` 소스오브트루스 경로. */
export const CURRICULUM_SOURCE_PATHS = {
  algebra: "data/math-curriculum/algebra.v1.json",
  calculus1: "data/math-curriculum/calculus1.v1.json",
} as const;

export interface LoadedCurriculumSource {
  source: CurriculumSource;
  validation: CurriculumGraphValidationResult;
}

/**
 * 저장소 루트 기준 상대경로의 교육과정 JSON을 로드해 zod 스키마로 파싱하고,
 * 그래프 정합성(validateCurriculumGraph)까지 함께 검사해서 돌려준다.
 * 파일이 없거나 JSON 파싱/스키마 검증에 실패하면 그대로 throw한다(CLI에서 잡아서 처리).
 */
export function loadCurriculumSource(relativePath: string): LoadedCurriculumSource {
  const raw = readFileSync(resolveRepoPath(relativePath), "utf-8");
  const parsed: unknown = JSON.parse(raw);
  const source = curriculumSourceSchema.parse(parsed);
  const validation = validateCurriculumGraph({
    subject: source.subject,
    nodes: source.nodes,
    prerequisites: source.prerequisites,
  });
  return { source, validation };
}
