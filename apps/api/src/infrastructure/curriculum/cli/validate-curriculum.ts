import { readFileSync } from "node:fs";
import type { CurriculumNodeType } from "../curriculumSourceSchema";
import { CURRICULUM_SOURCE_PATHS, loadCurriculumSource, resolveRepoPath } from "../loadCurriculumSource";
import { isKnownReferenceSourceType, referenceSourceSchema } from "../referenceSourceSchema";

const REFERENCE_SOURCE_PATHS = ["data/references/mathjk/source.json"] as const;

interface CountableNode {
  nodeType: CurriculumNodeType;
}

function countByType(nodes: CountableNode[], nodeType: CurriculumNodeType): number {
  return nodes.filter((node) => node.nodeType === nodeType).length;
}

/**
 * DB에 연결하지 않고 JSON 소스만으로 Problem DB Stage 1 콘텐츠 현황과 검증 결과를 출력한다.
 * `db:import-curriculum` 실행 전에 오너가 콘텐츠 규모/오류 여부를 빠르게 확인하는 용도.
 */
function main(): void {
  const algebra = loadCurriculumSource(CURRICULUM_SOURCE_PATHS.algebra);
  const calculus1 = loadCurriculumSource(CURRICULUM_SOURCE_PATHS.calculus1);

  const referenceSources = REFERENCE_SOURCE_PATHS.map((relativePath) =>
    referenceSourceSchema.parse(JSON.parse(readFileSync(resolveRepoPath(relativePath), "utf-8")) as unknown),
  );

  const lines: string[] = [];

  lines.push("## Algebra");
  lines.push(
    `Units: ${countByType(algebra.source.nodes, "UNIT")}, ` +
      `Subunits: ${countByType(algebra.source.nodes, "SUBUNIT")}, ` +
      `Concepts: ${countByType(algebra.source.nodes, "CONCEPT")}, ` +
      `Skills: ${countByType(algebra.source.nodes, "SKILL")}`,
  );

  lines.push("## Calculus I");
  lines.push(
    `Units: ${countByType(calculus1.source.nodes, "UNIT")}, ` +
      `Subunits: ${countByType(calculus1.source.nodes, "SUBUNIT")}, ` +
      `Concepts: ${countByType(calculus1.source.nodes, "CONCEPT")}, ` +
      `Skills: ${countByType(calculus1.source.nodes, "SKILL")}`,
  );

  lines.push("## Reference Sources");
  lines.push(
    `Total: ${referenceSources.length}, ` +
      `Verified: ${referenceSources.filter((source) => source.licenseVerified).length}, ` +
      `Reference Only: ${referenceSources.filter((source) => source.usageMode === "REFERENCE_ONLY").length}, ` +
      `Production Allowed: ${referenceSources.filter((source) => source.usageMode === "PRODUCTION_ALLOWED").length}`,
  );

  // 알 수 없는 sourceType(코드 레벨 allow-list 밖)은 하드 오류는 아니지만, 오타/신규
  // 소스타입 미등록 가능성이 있으므로 경고로 표면화한다(referenceSourceSchema.ts 결정사항 A).
  const unknownSourceTypeWarnings = referenceSources
    .filter((source) => !isKnownReferenceSourceType(source.sourceType))
    .map((source) => `알 수 없는 sourceType: ${source.sourceType} (${source.sourceUrl})`);
  for (const message of unknownSourceTypeWarnings) {
    lines.push(`Warning: ${message}`);
  }

  const errors = algebra.validation.errors.length + calculus1.validation.errors.length;
  const warnings =
    algebra.validation.warnings.length + calculus1.validation.warnings.length + unknownSourceTypeWarnings.length;

  lines.push("## Validation");
  lines.push(`Errors: ${errors}, Warnings: ${warnings}, ${errors === 0 ? "PASS" : "FAIL"}`);

  console.log(lines.join("\n"));

  for (const message of [...algebra.validation.errors, ...calculus1.validation.errors]) {
    console.error(` - ${message}`);
  }

  if (errors > 0) {
    process.exitCode = 1;
  }
}

main();
