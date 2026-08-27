import { readFileSync } from "node:fs";
import { z } from "zod";
import { loadCurriculumSource, resolveRepoPath } from "../../curriculum/loadCurriculumSource";
import { buildCurriculumNodeIndex } from "../curriculumMapping";
import { buildLocalItemKey } from "../itemSegmentation";
import {
  calculationLoadSchema,
  representationTypeSchema,
} from "../referenceItemFeatureSchema";

/**
 * DB에 연결하지 않고 파일럿 큐레이션 JSON 아티팩트만 검증한다.
 * `db:validate-curriculum`(Stage 1)과 동일한 패턴: 순수 JSON 기반, 오너가
 * 실제 DB에 반영하기 전에 빠르게 오류 여부를 확인하는 용도.
 */
const CURATED_FEATURES_PATH = "data/references/mathjk/algebra/pilot-item-features.json";
const CURRICULUM_SOURCE_PATH = "data/math-curriculum/algebra.v1.json";

/** 원문 발췌 의심 방어용: 이 길이를 넘는 서술 필드는 경고로 남긴다(하드 실패는 아님). */
const SUSPICIOUSLY_LONG_TEXT_THRESHOLD = 220;

const pilotItemDraftSchema = z.object({
  pageNumber: z.number().int().positive(),
  sequenceInPage: z.number().int().positive(),
  curriculumNodeCodes: z.array(z.string().min(1)),
  primaryConcept: z.string().min(1).max(200),
  secondaryConcepts: z.array(z.string().min(1)).nullable(),
  requiredSkills: z.array(z.string().min(1)).nullable(),
  prerequisiteSkills: z.array(z.string().min(1)).nullable(),
  representationType: representationTypeSchema,
  answerFormat: z.string().nullable(),
  conditionCount: z.number().int().min(0),
  reasoningPattern: z.string().min(1),
  reasoningStepCount: z.number().int().min(0),
  calculationLoad: calculationLoadSchema,
  conceptLoad: z.number().int().min(0),
  transformationPattern: z.array(z.string().min(1)).nullable(),
  graphOrDiagramRequired: z.boolean(),
  commonTrapCandidate: z.string().max(200).nullable(),
  caseSplitRequired: z.boolean(),
  nontrivialTransformationRequired: z.boolean(),
  canonicalReasoningSteps: z.array(z.string().min(1).max(200)).nullable(),
});

const pilotDatasetSchema = z.object({
  document: z.object({
    documentKey: z.string().min(1),
    filename: z.string().min(1),
    subject: z.string().min(1),
    unit: z.string().min(1),
    curriculumVersion: z.string().min(1),
  }),
  sampleRangeNote: z.string().min(1),
  items: z.array(pilotItemDraftSchema).min(1),
});

function main(): void {
  const errors: string[] = [];
  const warnings: string[] = [];

  const raw: unknown = JSON.parse(readFileSync(resolveRepoPath(CURATED_FEATURES_PATH), "utf-8"));

  const parseResult = pilotDatasetSchema.safeParse(raw);
  if (!parseResult.success) {
    for (const issue of parseResult.error.issues) {
      errors.push(`스키마 오류: ${issue.path.join(".")} - ${issue.message}`);
    }
    printResult(errors, warnings);
    return;
  }
  const dataset = parseResult.data;

  const { source: curriculumSource, validation } = loadCurriculumSource(CURRICULUM_SOURCE_PATH);
  if (validation.errors.length > 0) {
    errors.push("algebra.v1.json 자체가 그래프 검증에 실패했습니다(Stage 1 회귀). 먼저 그 문제부터 해결하세요.");
  }
  const nodesByCode = buildCurriculumNodeIndex(curriculumSource);

  const localItemKeys = new Set(
    dataset.items.map((item) => buildLocalItemKey(dataset.document.documentKey, item.pageNumber, item.sequenceInPage)),
  );

  // 1) curriculum_node_codes가 algebra.v1.json에 실존하는지
  for (const item of dataset.items) {
    for (const code of item.curriculumNodeCodes) {
      if (!nodesByCode.has(code)) {
        warnings.push(
          `커리큘럼 갭 후보: p${item.pageNumber}-i${item.sequenceInPage}의 curriculumNodeCodes(${code})가 ` +
            "algebra.v1.json에 없습니다(새 노드를 만들지 않고 갭으로만 남깁니다).",
        );
      }
    }
  }

  // 2) local_item_key 중복 여부(페이지+순번 조합이 겹치지 않는지)
  const seenKeys = new Set<string>();
  for (const item of dataset.items) {
    const key = buildLocalItemKey(dataset.document.documentKey, item.pageNumber, item.sequenceInPage);
    if (seenKeys.has(key)) {
      errors.push(`중복 local_item_key: ${key}`);
    }
    seenKeys.add(key);
  }

  // 3) 원문 의심 긴 텍스트 방어(하드 실패 아님, 경고만)
  for (const item of dataset.items) {
    const key = buildLocalItemKey(dataset.document.documentKey, item.pageNumber, item.sequenceInPage);
    const longFields: Array<[string, string | null]> = [
      ["primaryConcept", item.primaryConcept],
      ["commonTrapCandidate", item.commonTrapCandidate],
      ["reasoningPattern", item.reasoningPattern],
      ...(item.canonicalReasoningSteps ?? []).map(
        (step, index): [string, string] => [`canonicalReasoningSteps[${index}]`, step],
      ),
    ];
    for (const [field, value] of longFields) {
      if (value !== null && value.length > SUSPICIOUSLY_LONG_TEXT_THRESHOLD) {
        warnings.push(
          `원문 발췌 의심(길이 ${value.length}자): ${key}.${field} — 문항 원문을 그대로 옮기지 않았는지 확인하세요.`,
        );
      }
    }
  }

  // evidence_item_keys 교차검증은 이 아티팩트 자체에는 problem_family_candidates가 없어
  // (family는 CLI 실행 시점에 그룹화로 생성됨) 여기서는 local_item_key 집합만 확인한다.
  if (localItemKeys.size !== dataset.items.length) {
    errors.push("localItemKeys 집합 크기와 items 개수가 다릅니다(중복 키 가능성).");
  }

  console.log(`## ${dataset.document.documentKey}`);
  console.log(`Items: ${dataset.items.length}`);
  console.log(dataset.sampleRangeNote);

  printResult(errors, warnings);
}

function printResult(errors: string[], warnings: string[]): void {
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
