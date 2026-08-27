import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { curriculumRepository } from "../../curriculum/curriculumRepository";
import { resolveRepoPath } from "../../curriculum/loadCurriculumSource";
import { referenceSourceSchema } from "../../curriculum/referenceSourceSchema";
import { extractPdfMetadata } from "../../referenceAnalysis/pdf/extractPdfMetadata";
import { referenceAnalysisRepository } from "../../referenceAnalysis/referenceAnalysisRepository";
import { examCalibrationRepository } from "../examCalibrationRepository";
import { examItemFeatureSchema, examSubjectMappingSchema, examRepresentationTypeSchema, examCalculationLoadSchema, examConditionInterpretationLoadSchema, curriculumCompatibilitySchema } from "../examItemFeatureSchema";
import { examReferenceSetSchema } from "../examReferenceSetSchema";

/**
 * Problem DB Stage 3 — Gold Set(2028학년도 수능 예시문항) 임포터.
 *
 * 저작권 안전 정책(중요): Stage 2와 동일하게 로컬 PDF 파일 경로를 하드코딩된 값으로만
 * 다룬다. `pdf/extractPdfMetadata.ts`(sha256 해시 + 페이지 수만 추출, 텍스트/이미지는 다루지
 * 않음)를 그대로 재사용하며, 문항 원문/페이지 이미지를 OpenAI/Anthropic 등 외부 AI API로
 * 전송하는 코드가 없다(`apps/api/src/infrastructure/ai/`의 `LLMAdapter`를 import하지 않는다).
 * 문항 특징 데이터는 개발자가 PDF를 직접 열람해 수동으로 큐레이션한
 * `gold-item-features.json`에서만 가져온다.
 */
const GOLD_SET_RELATIVE_PDF_PATH =
  "data/references/kice/2028-sample/2028학년도 수능 예시문항 문제지ㆍ정답표 - 수학.pdf";
const GOLD_ITEM_FEATURES_RELATIVE_PATH = "data/references/kice/2028-sample/gold-item-features.json";
const KICE_SOURCE_RELATIVE_PATH = "data/references/kice/source.json";

const EXTRACTION_VERSION = "stage3-v1";
const DOCUMENT_KEY = "kice-2028-sample-math";

const goldItemDraftSchema = z
  .object({
    itemNumber: z.number().int().positive(),
    subjectMapping: examSubjectMappingSchema,
    curriculumNodeCodes: z.array(z.string().min(1)),
    primaryConcept: z.string().max(200).nullable(),
    secondaryConcepts: z.array(z.string().min(1)).nullable(),
    requiredSkills: z.array(z.string().min(1)).nullable(),
    prerequisiteSkills: z.array(z.string().min(1)).nullable(),
    representationType: examRepresentationTypeSchema.nullable(),
    reasoningSignature: z.string().nullable(),
    reasoningStepCount: z.number().int().min(0).nullable(),
    calculationLoad: examCalculationLoadSchema.nullable(),
    conceptLoad: z.number().int().min(0).nullable(),
    conditionInterpretationLoad: examConditionInterpretationLoadSchema.nullable(),
    caseSplitRequired: z.boolean(),
    representationConversion: z.boolean(),
    nonObviousTransformation: z.boolean(),
    answerFormat: z.string().nullable(),
    officialPointValue: z.number().int().min(1).max(10).nullable(),
    curriculumCompatibility: curriculumCompatibilitySchema.nullable(),
  })
  .refine(
    (value) => value.subjectMapping !== "OUT_OF_CURRENT_SCOPE" || value.curriculumCompatibility === null,
    {
      message: "subjectMapping이 OUT_OF_CURRENT_SCOPE이면 curriculumCompatibility는 반드시 null이어야 합니다.",
      path: ["curriculumCompatibility"],
    },
  );
type GoldItemDraft = z.infer<typeof goldItemDraftSchema>;

const goldDatasetSchema = z.object({
  examReferenceSet: z.object({
    examCode: z.string().min(1),
    examType: z.enum(["SAMPLE", "CSAT", "JUNE_MOCK", "SEPT_MOCK", "OTHER_MOCK"]),
    examYear: z.number().int(),
    curriculumVersion: z.string().min(1),
    authority: z.string().min(1),
    evidenceTier: z.enum(["GOLD_2028_SAMPLE", "SILVER_KICE", "REFERENCE_OTHER"]),
    filename: z.string().min(1),
  }),
  curationNote: z.string().min(1),
  items: z.array(goldItemDraftSchema).min(1),
});
export type GoldDataset = z.infer<typeof goldDatasetSchema>;

interface CliOptions {
  apply: boolean;
}

function parseCliOptions(argv: string[]): CliOptions {
  return { apply: argv.includes("--apply") };
}

/** JSON만 읽어 파싱한다(DB 접근 없음). CLI 본체와 검증 스크립트가 함께 재사용한다. */
export function loadGoldDataset(): GoldDataset {
  const raw: unknown = JSON.parse(readFileSync(resolveRepoPath(GOLD_ITEM_FEATURES_RELATIVE_PATH), "utf-8"));
  return goldDatasetSchema.parse(raw);
}

async function main(): Promise<void> {
  const options = parseCliOptions(process.argv.slice(2));
  const dataset = loadGoldDataset();

  const pdfPath = resolveRepoPath(GOLD_SET_RELATIVE_PDF_PATH);
  console.log(`Gold Set Document: ${path.basename(pdfPath)}`);
  const metadata = await extractPdfMetadata(pdfPath);
  console.log(`  sha256=${metadata.fileHash}`);
  console.log(`  pages=${metadata.pageCount}`);

  const inScopeCount = dataset.items.filter((item) => item.subjectMapping !== "OUT_OF_CURRENT_SCOPE").length;
  const outOfScopeCount = dataset.items.length - inScopeCount;
  const algCount = dataset.items.filter((item) => item.subjectMapping === "ALG").length;
  const calc1Count = dataset.items.filter((item) => item.subjectMapping === "CALC1").length;

  console.log(
    `Gold Set: relevant=${inScopeCount}(대수 ${algCount}/미적분Ⅰ ${calc1Count}) / out-of-current-scope=${outOfScopeCount}`,
  );

  if (!options.apply) {
    console.log("\n(dry-run 모드입니다. 실제로 DB에 반영하려면 --apply 플래그를 추가하세요.)");
    return;
  }

  console.log("\n--apply 플래그가 지정되어 실제 DB에 반영합니다...");

  // KICE reference_sources는 Stage 1 `db:import-curriculum`의 하드코딩된 목록에 포함되어 있지
  // 않다(Stage 1 파일은 이번 단계에서 건드리지 않는다) — 대신 Stage 1의 기존 리포지토리
  // 메서드(`curriculumRepository.saveReferenceSource`, source_url 기준 upsert이므로 멱등)를
  // 그대로 재사용해 이 CLI 안에서 직접 등록한 뒤 id를 조회한다.
  const kiceSource = referenceSourceSchema.parse(
    JSON.parse(readFileSync(resolveRepoPath(KICE_SOURCE_RELATIVE_PATH), "utf-8")),
  );
  await curriculumRepository.saveReferenceSource(kiceSource);
  console.log(`reference_sources upsert 완료: ${kiceSource.sourceUrl}`);
  const sourceId = await referenceAnalysisRepository.resolveReferenceSourceIdByUrl(kiceSource.sourceUrl);

  const examReferenceSetInput = examReferenceSetSchema.parse({
    sourceId,
    examCode: dataset.examReferenceSet.examCode,
    examType: dataset.examReferenceSet.examType,
    examYear: dataset.examReferenceSet.examYear,
    curriculumVersion: dataset.examReferenceSet.curriculumVersion,
    authority: dataset.examReferenceSet.authority,
    evidenceTier: dataset.examReferenceSet.evidenceTier,
    licenseStatus: "UNVERIFIED",
    usageMode: "REFERENCE_ONLY",
    documentKey: DOCUMENT_KEY,
    filename: dataset.examReferenceSet.filename,
    fileHash: metadata.fileHash,
    pageCount: metadata.pageCount,
    extractionVersion: EXTRACTION_VERSION,
    parserVersion: metadata.parserVersion,
    processedAt: new Date().toISOString(),
    isActive: true,
  });
  const examReferenceSetId = await examCalibrationRepository.saveExamReferenceSet(examReferenceSetInput);
  console.log(`exam_reference_sets upsert 완료: ${dataset.examReferenceSet.examCode} (id=${examReferenceSetId})`);

  const itemInputs = dataset.items.map((item) => buildExamItemFeatureInput(item, examReferenceSetId));
  const savedRows = await examCalibrationRepository.saveExamItemFeatures(itemInputs);
  console.log(`exam_item_features upsert 완료: ${savedRows.length}개`);
}

function buildExamItemFeatureInput(item: GoldItemDraft, examReferenceSetId: string) {
  return examItemFeatureSchema.parse({
    examReferenceSetId,
    itemNumber: item.itemNumber,
    subjectMapping: item.subjectMapping,
    curriculumNodeCodes: item.curriculumNodeCodes,
    primaryConcept: item.primaryConcept,
    secondaryConcepts: item.secondaryConcepts,
    requiredSkills: item.requiredSkills,
    prerequisiteSkills: item.prerequisiteSkills,
    representationType: item.representationType,
    reasoningSignature: item.reasoningSignature,
    reasoningStepCount: item.reasoningStepCount,
    calculationLoad: item.calculationLoad,
    conceptLoad: item.conceptLoad,
    conditionInterpretationLoad: item.conditionInterpretationLoad,
    caseSplitRequired: item.caseSplitRequired,
    representationConversion: item.representationConversion,
    nonObviousTransformation: item.nonObviousTransformation,
    answerFormat: item.answerFormat,
    officialPointValue: item.officialPointValue,
    curriculumCompatibility: item.curriculumCompatibility,
    extractionConfidence: null,
    reviewStatus: "NEEDS_REVIEW",
  });
}

// CLI로 직접 실행됐을 때만 파이프라인을 구동한다(테스트에서 순수 함수만 안전하게 import하기 위함).
const isDirectExecution =
  process.argv[1] !== undefined && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isDirectExecution) {
  main().catch((error: unknown) => {
    console.error("Gold Set 임포트 실패", error);
    process.exitCode = 1;
  });
}
