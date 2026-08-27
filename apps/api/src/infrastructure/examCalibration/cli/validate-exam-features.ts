import { CURRICULUM_SOURCE_PATHS, loadCurriculumSource } from "../../curriculum/loadCurriculumSource";
import { buildCurriculumNodeIndex } from "../../referenceAnalysis/curriculumMapping";
import { selectCompatibleExamItems } from "../historicalCompatibilityGuard";
import { loadGoldDataset } from "./ingest-gold-set";

/**
 * DB에 연결하지 않고 `gold-item-features.json` 아티팩트만 검증한다.
 * `reference:validate-features`(Stage 2)/`db:validate-curriculum`(Stage 1)과 동일한 패턴:
 * 순수 JSON 기반, 오너가 실제 DB에 반영하기 전에 빠르게 오류 여부를 확인하는 용도.
 */
function main(): void {
  const errors: string[] = [];
  const warnings: string[] = [];

  const dataset = loadGoldDataset();

  const { source: algebra } = loadCurriculumSource(CURRICULUM_SOURCE_PATHS.algebra);
  const { source: calculus1 } = loadCurriculumSource(CURRICULUM_SOURCE_PATHS.calculus1);
  const nodesByCode = new Map([
    ...buildCurriculumNodeIndex(algebra),
    ...buildCurriculumNodeIndex(calculus1),
  ]);

  // 1) item_number 중복 여부
  const seenItemNumbers = new Set<number>();
  for (const item of dataset.items) {
    if (seenItemNumbers.has(item.itemNumber)) {
      errors.push(`중복 item_number: ${item.itemNumber}`);
    }
    seenItemNumbers.add(item.itemNumber);
  }

  // 2) curriculumNodeCodes가 algebra.v1.json/calculus1.v1.json에 실존하는지
  for (const item of dataset.items) {
    for (const code of item.curriculumNodeCodes) {
      if (!nodesByCode.has(code)) {
        warnings.push(
          `커리큘럼 갭 후보: item ${item.itemNumber}의 curriculumNodeCodes(${code})가 커리큘럼 그래프에 없습니다.`,
        );
      }
    }
  }

  // 3) subjectMapping='OUT_OF_CURRENT_SCOPE'인데 curriculumNodeCodes가 비어있지 않은 경우
  for (const item of dataset.items) {
    if (item.subjectMapping === "OUT_OF_CURRENT_SCOPE" && item.curriculumNodeCodes.length > 0) {
      errors.push(`item ${item.itemNumber}: OUT_OF_CURRENT_SCOPE인데 curriculumNodeCodes가 비어있지 않습니다.`);
    }
  }

  // 4) INCOMPATIBLE 항목이 스코어링에 기여하지 않는지(historicalCompatibilityGuard 회귀 확인)
  const inScopeItems = dataset.items.filter((item) => item.subjectMapping !== "OUT_OF_CURRENT_SCOPE");
  const compatibleItems = selectCompatibleExamItems(inScopeItems);
  const incompatibleCount = inScopeItems.length - compatibleItems.length;

  const outOfScopeCount = dataset.items.length - inScopeItems.length;
  const algCount = dataset.items.filter((item) => item.subjectMapping === "ALG").length;
  const calc1Count = dataset.items.filter((item) => item.subjectMapping === "CALC1").length;

  console.log(`## ${dataset.examReferenceSet.examCode}`);
  console.log(`Items: ${dataset.items.length} (ALG=${algCount}, CALC1=${calc1Count}, OUT_OF_CURRENT_SCOPE=${outOfScopeCount})`);
  console.log(`Incompatible(historicalCompatibilityGuard로 스코어링 제외 대상): ${incompatibleCount}`);
  console.log(dataset.curationNote);

  console.log("\n## Validation");
  console.log(`Errors: ${errors.length}, Warnings: ${warnings.length}, ${errors.length === 0 ? "PASS" : "FAIL"}`);
  for (const message of errors) {
    console.error(` - [ERROR] ${message}`);
  }
  for (const message of warnings) {
    console.warn(` - [WARN] ${message}`);
  }
  if (errors.length > 0) {
    process.exitCode = 1;
  }
}

main();
