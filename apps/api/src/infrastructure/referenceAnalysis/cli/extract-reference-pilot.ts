import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { loadCurriculumSource, resolveRepoPath } from "../../curriculum/loadCurriculumSource";
import { classifyItemPair, type DedupClassification } from "../deduplication";
import { estimateReferenceDifficulty } from "../difficultyEstimate";
import { buildFamilySignature, groupItemsIntoFamilies } from "../familyGrouping";
import { buildLocalItemKey, segmentPageIntoItems } from "../itemSegmentation";
import {
  classifyCurriculumMapping,
  buildCurriculumNodeIndex,
  type CurriculumMappingResult,
} from "../curriculumMapping";
import { extractPdfMetadata } from "../pdf/extractPdfMetadata";
import { extractPageText } from "../pdf/extractPageText";
import { problemFamilyCandidateSchema, type ProblemFamilyCandidateInput } from "../problemFamilyCandidateSchema";
import { referenceDocumentSchema, type ReferenceDocumentInput } from "../referenceDocumentSchema";
import {
  calculationLoadSchema,
  referenceItemFeatureSchema,
  representationTypeSchema,
  type ReferenceItemFeatureInput,
} from "../referenceItemFeatureSchema";
import { referenceAnalysisRepository } from "../referenceAnalysisRepository";

/**
 * Problem DB Stage 2 파일럿 파이프라인.
 *
 * 저작권 안전 정책(중요): 이 스크립트는 로컬 PDF 파일 경로만 하드코딩된 배열(allowlist)로
 * 다룬다 — 재귀 디렉터리 스캔이나 `ProblemDB/`(AI-Hub 데이터셋) 접근, 다른 PDF 자동 탐색은
 * 절대 하지 않는다. 문항 원문/페이지 이미지를 OpenAI/Anthropic 등 외부 AI API로 전송하는
 * 코드가 없으며, `apps/api/src/infrastructure/ai/`의 `LLMAdapter`를 import하지도 않는다.
 * 피처 데이터는 개발자가 로컬 캐시 텍스트를 직접 읽고 수동으로 큐레이션한
 * `pilot-item-features.json`에서만 가져온다.
 */
const PILOT_PDF_ALLOWLIST = [
  {
    documentKey: "mathjk-alg-explog-01",
    relativePdfPath: "data/references/mathjk/algebra/수악중독 유형 - 대수 - 1. 지수함수와 로그함수.pdf",
    curatedFeaturesPath: "data/references/mathjk/algebra/pilot-item-features.json",
    curriculumSourceRelativePath: "data/math-curriculum/algebra.v1.json",
    referenceSourceUrl: "https://mathjk.tistory.com/3584",
    cacheDirRelativePath: "data/references/mathjk/algebra/.extraction-cache",
  },
] as const;

const EXTRACTION_VERSION = "stage2-v1";

/** 파일럿 표본 범위(2~30페이지) — 명확히 식별되는 문항 위주로 표본을 구성했다(전수 분석 아님). */
const SAMPLE_FROM_PAGE = 1;
const SAMPLE_TO_PAGE = 30;

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
export type PilotItemDraft = z.infer<typeof pilotItemDraftSchema>;

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

interface CliOptions {
  apply: boolean;
}

function parseCliOptions(argv: string[]): CliOptions {
  return { apply: argv.includes("--apply") };
}

function main(): Promise<void> {
  const options = parseCliOptions(process.argv.slice(2));
  const entry = PILOT_PDF_ALLOWLIST[0];

  return runPilot(entry, options);
}

async function runPilot(entry: (typeof PILOT_PDF_ALLOWLIST)[number], options: CliOptions): Promise<void> {
  const pdfPath = resolveRepoPath(entry.relativePdfPath);

  console.log(`Pilot Document: ${path.basename(pdfPath)}`);
  const metadata = await extractPdfMetadata(pdfPath);
  console.log(`  sha256=${metadata.fileHash}`);
  console.log(`  pages=${metadata.pageCount}`);

  const toPage = Math.min(SAMPLE_TO_PAGE, metadata.pageCount);
  const pages = await extractPageText(pdfPath, { fromPage: SAMPLE_FROM_PAGE, toPage });
  console.log(`  extraction=성공 (표본 범위: p${SAMPLE_FROM_PAGE}-p${toPage})`);

  // 로컬 캐시에만 저장한다(DB 저장 대상 아님, .gitignore 대상).
  const cacheDir = path.join(resolveRepoPath(entry.cacheDirRelativePath), entry.documentKey);
  mkdirSync(cacheDir, { recursive: true });
  for (const page of pages) {
    writeFileSync(
      path.join(cacheDir, `page-${String(page.pageNumber).padStart(3, "0")}.txt`),
      page.text,
      "utf-8",
    );
  }

  const segmentationByPage = new Map(pages.map((page) => [page.pageNumber, segmentPageIntoItems(page)]));

  const rawDataset: unknown = JSON.parse(readFileSync(resolveRepoPath(entry.curatedFeaturesPath), "utf-8"));
  const dataset = pilotDatasetSchema.parse(rawDataset);

  const { source: curriculumSource } = loadCurriculumSource(entry.curriculumSourceRelativePath);
  const curriculumNodesByCode = buildCurriculumNodeIndex(curriculumSource);

  const documentKey = dataset.document.documentKey;

  const enrichedItems = dataset.items.map((item) => enrichItem(item, documentKey, segmentationByPage));

  const curriculumClassifications = enrichedItems.map((item) =>
    classifyCurriculumMapping(item.draft.curriculumNodeCodes, curriculumNodesByCode),
  );
  const unresolvedGapCodes = new Set(curriculumClassifications.flatMap((result) => result.unresolvedNodeCodes));

  // Stage 2 요구사항: OUT_OF_SCOPE로 분류된 아이템은 family candidate 생성/저장 대상에서
  // 제외한다. 리포트 집계(mappingTally 등)는 필터링 전 전체 아이템 기준을 그대로 사용한다.
  const inScopeItems = selectInScopeItems(enrichedItems, curriculumClassifications);

  const families = groupItemsIntoFamilies(
    inScopeItems.map((item) => ({
      localItemKey: item.localItemKey,
      primaryConcept: item.draft.primaryConcept,
      reasoningPattern: item.draft.reasoningPattern,
      representationType: item.draft.representationType,
      requiredSkills: item.draft.requiredSkills,
      conditionCount: item.draft.conditionCount,
    })),
  );

  const dedupTally: Record<DedupClassification, number> = {
    EXACT_DUP: 0,
    APPROX_DUP: 0,
    SAME_REASONING_DIFFERENT_SURFACE: 0,
    SIMILAR_SURFACE_DIFFERENT_REASONING: 0,
  };
  for (const family of families) {
    for (let i = 0; i < family.items.length; i += 1) {
      for (let j = i + 1; j < family.items.length; j += 1) {
        const a = inScopeItems.find((item) => item.localItemKey === family.items[i]!.localItemKey)!;
        const b = inScopeItems.find((item) => item.localItemKey === family.items[j]!.localItemKey)!;
        const result = classifyItemPair(toDedupInput(a), toDedupInput(b));
        dedupTally[result.classification] += 1;
      }
    }
  }

  const familyCandidates: ProblemFamilyCandidateInput[] = families.map((family, index) =>
    buildFamilyCandidate(family, index, inScopeItems, dataset.document.subject, dataset.document.unit),
  );

  const difficultyTally: Record<string, number> = { D1: 0, D2: 0, D3: 0, D4: 0, D5: 0, UNKNOWN: 0 };
  for (const item of enrichedItems) {
    difficultyTally[item.approximateDifficulty] = (difficultyTally[item.approximateDifficulty] ?? 0) + 1;
  }

  const mappingTally = { EXACT: 0, MULTI_NODE: 0, UNCERTAIN: 0, OUT_OF_SCOPE: 0 };
  for (const result of curriculumClassifications) {
    mappingTally[result.classification] += 1;
  }

  const familyReviewRequiredCount = familyCandidates.filter((c) => c.status === "REVIEW_REQUIRED").length;
  const familyRejectedCount = familyCandidates.filter((c) => c.status === "REJECTED").length;
  const duplicateMergedGroups = familyCandidates.filter((c) => c.sourceItemCount >= 2).length;

  printReport({
    filename: path.basename(pdfPath),
    fileHash: metadata.fileHash,
    pageCount: metadata.pageCount,
    sampleFromPage: SAMPLE_FROM_PAGE,
    sampleToPage: toPage,
    detectedCount: countSegmentedItems(segmentationByPage),
    analyzedCount: enrichedItems.length,
    uncertainCount: mappingTally.UNCERTAIN,
    outOfScopeCount: mappingTally.OUT_OF_SCOPE,
    failedCount: 0,
    mappingTally,
    familyCount: familyCandidates.length,
    familyReviewRequiredCount,
    familyRejectedCount,
    duplicateMergedGroups,
    difficultyTally,
    curriculumGapCodes: Array.from(unresolvedGapCodes),
  });

  if (!options.apply) {
    console.log("\n(dry-run 모드입니다. 실제로 DB에 반영하려면 --apply 플래그를 추가하세요.)");
    return;
  }

  console.log("\n--apply 플래그가 지정되어 실제 DB에 반영합니다...");
  const sourceId = await referenceAnalysisRepository.resolveReferenceSourceIdByUrl(entry.referenceSourceUrl);

  const documentInput: ReferenceDocumentInput = referenceDocumentSchema.parse({
    sourceId,
    documentKey,
    filename: dataset.document.filename,
    subject: dataset.document.subject,
    unit: dataset.document.unit,
    curriculumVersion: dataset.document.curriculumVersion,
    fileHash: metadata.fileHash,
    pageCount: metadata.pageCount,
    extractionVersion: EXTRACTION_VERSION,
    parserVersion: metadata.parserVersion,
    usageMode: "REFERENCE_ONLY",
    licenseStatus: "UNVERIFIED",
    processedAt: new Date().toISOString(),
  });
  const referenceDocumentId = await referenceAnalysisRepository.saveReferenceDocument(documentInput);
  console.log(`reference_documents upsert 완료: ${documentKey} (id=${referenceDocumentId})`);

  const featureInputs: ReferenceItemFeatureInput[] = enrichedItems.map((item) =>
    referenceItemFeatureSchema.parse({
      referenceDocumentId,
      localItemKey: item.localItemKey,
      pageNumber: item.draft.pageNumber,
      curriculumNodeCodes: item.draft.curriculumNodeCodes,
      primaryConcept: item.draft.primaryConcept,
      secondaryConcepts: item.draft.secondaryConcepts,
      requiredSkills: item.draft.requiredSkills,
      prerequisiteSkills: item.draft.prerequisiteSkills,
      representationType: item.draft.representationType,
      answerFormat: item.draft.answerFormat,
      conditionCount: item.draft.conditionCount,
      reasoningPattern: item.draft.reasoningPattern,
      reasoningStepCount: item.draft.reasoningStepCount,
      calculationLoad: item.draft.calculationLoad,
      conceptLoad: item.draft.conceptLoad,
      transformationPattern: item.draft.transformationPattern,
      graphOrDiagramRequired: item.draft.graphOrDiagramRequired,
      commonTrapCandidate: item.draft.commonTrapCandidate,
      approximateDifficulty: item.approximateDifficulty,
      familySignature: item.familySignature,
      extractionConfidence: item.extractionConfidence,
      reviewStatus: "NEEDS_REVIEW",
    }),
  );
  await referenceAnalysisRepository.saveReferenceItemFeatures(featureInputs);
  console.log(`reference_item_features upsert 완료: ${featureInputs.length}개`);

  const parsedFamilyCandidates = familyCandidates.map((candidate) => problemFamilyCandidateSchema.parse(candidate));
  await referenceAnalysisRepository.saveProblemFamilyCandidates(parsedFamilyCandidates);
  console.log(`problem_family_candidates upsert 완료: ${parsedFamilyCandidates.length}개`);
}

export interface EnrichedItem {
  draft: PilotItemDraft;
  localItemKey: string;
  extractionConfidence: number;
  approximateDifficulty: "D1" | "D2" | "D3" | "D4" | "D5" | "UNKNOWN";
  familySignature: string;
}

export function enrichItem(
  draft: PilotItemDraft,
  documentKey: string,
  segmentationByPage: Map<number, ReturnType<typeof segmentPageIntoItems>>,
): EnrichedItem {
  const localItemKey = buildLocalItemKey(documentKey, draft.pageNumber, draft.sequenceInPage);

  const pageCandidates = segmentationByPage.get(draft.pageNumber) ?? [];
  const matchedCandidate = pageCandidates.find((candidate) => candidate.sequenceInPage === draft.sequenceInPage);
  // 자동 세그멘테이션이 이 문항을 못 찾았으면 보수적으로 낮은 confidence를 부여한다.
  const extractionConfidence = matchedCandidate?.confidence ?? 0.5;

  const { difficulty } = estimateReferenceDifficulty({
    conceptLoad: draft.conceptLoad,
    reasoningStepCount: draft.reasoningStepCount,
    conditionCount: draft.conditionCount,
    calculationLoad: draft.calculationLoad,
    caseSplitRequired: draft.caseSplitRequired,
    nontrivialTransformationRequired: draft.nontrivialTransformationRequired,
  });

  const familySignature = buildFamilySignature({
    localItemKey,
    primaryConcept: draft.primaryConcept,
    reasoningPattern: draft.reasoningPattern,
    representationType: draft.representationType,
    requiredSkills: draft.requiredSkills,
    conditionCount: draft.conditionCount,
  });

  return { draft, localItemKey, extractionConfidence, approximateDifficulty: difficulty, familySignature };
}

/**
 * Stage 2 요구사항: OUT_OF_SCOPE로 분류된 아이템은 family candidate 생성(및 저장) 대상에서
 * 반드시 제외해야 한다. `items[i]`와 `classifications[i]`가 같은 인덱스로 대응한다고 가정하는
 * 순수 함수 — 리포트 집계는 필터링 전 `items`/`classifications`를 그대로 사용해야 한다.
 */
export function selectInScopeItems<T>(items: readonly T[], classifications: readonly CurriculumMappingResult[]): T[] {
  return items.filter((_, index) => classifications[index]?.classification !== "OUT_OF_SCOPE");
}

export function toDedupInput(item: EnrichedItem) {
  return {
    localItemKey: item.localItemKey,
    primaryConcept: item.draft.primaryConcept,
    reasoningPattern: item.draft.reasoningPattern,
    representationType: item.draft.representationType,
    requiredSkills: item.draft.requiredSkills,
    conditionCount: item.draft.conditionCount,
    answerFormat: item.draft.answerFormat,
    transformationPattern: item.draft.transformationPattern,
  };
}

const DIFFICULTY_ORDER = ["D1", "D2", "D3", "D4", "D5"] as const;
type KnownDifficulty = (typeof DIFFICULTY_ORDER)[number];

export function buildFamilyCandidate(
  family: ReturnType<typeof groupItemsIntoFamilies>[number],
  index: number,
  enrichedItems: EnrichedItem[],
  subject: string,
  unit: string,
): ProblemFamilyCandidateInput {
  const members = family.items.map(
    (member) => enrichedItems.find((item) => item.localItemKey === member.localItemKey)!,
  );
  const first = members[0]!;

  const requiredSkills = Array.from(new Set(members.flatMap((m) => m.draft.requiredSkills ?? []))).sort();
  const curriculumNodeCodes = Array.from(new Set(members.flatMap((m) => m.draft.curriculumNodeCodes))).sort();
  const representationTypes = Array.from(new Set(members.map((m) => m.draft.representationType))).sort();
  const knownDifficulties = members
    .map((m) => m.approximateDifficulty)
    .filter((d): d is KnownDifficulty => (DIFFICULTY_ORDER as readonly string[]).includes(d));
  const min = knownDifficulties.length > 0 ? knownDifficulties.reduce((a, b) => (a < b ? a : b)) : "UNKNOWN";
  const max = knownDifficulties.length > 0 ? knownDifficulties.reduce((a, b) => (a > b ? a : b)) : "UNKNOWN";

  const confidenceAvg =
    members.reduce((sum, m) => sum + m.extractionConfidence, 0) / members.length;

  return {
    candidateCode: `FAM-${subject}-EXPLOG-${String(index + 1).padStart(3, "0")}`,
    subject,
    unit,
    curriculumNodeCodes,
    familyName: first.draft.primaryConcept,
    coreConcept: first.draft.primaryConcept,
    requiredSkills,
    reasoningSignature: family.familySignature,
    canonicalReasoningSteps: first.draft.canonicalReasoningSteps,
    representationTypes,
    prerequisiteNodes: null,
    approximateDifficultyMin: min,
    approximateDifficultyMax: max,
    sourceItemCount: members.length,
    evidenceItemKeys: members.map((m) => m.localItemKey),
    confidence: Math.round(confidenceAvg * 100) / 100,
    status: members.length >= 2 ? "CANDIDATE" : "REVIEW_REQUIRED",
  };
}

function countSegmentedItems(segmentationByPage: Map<number, ReturnType<typeof segmentPageIntoItems>>): number {
  let total = 0;
  for (const candidates of segmentationByPage.values()) {
    total += candidates.length;
  }
  return total;
}

interface ReportInput {
  filename: string;
  fileHash: string;
  pageCount: number;
  sampleFromPage: number;
  sampleToPage: number;
  detectedCount: number;
  analyzedCount: number;
  uncertainCount: number;
  outOfScopeCount: number;
  failedCount: number;
  mappingTally: { EXACT: number; MULTI_NODE: number; UNCERTAIN: number; OUT_OF_SCOPE: number };
  familyCount: number;
  familyReviewRequiredCount: number;
  familyRejectedCount: number;
  duplicateMergedGroups: number;
  difficultyTally: Record<string, number>;
  curriculumGapCodes: string[];
}

function printReport(input: ReportInput): void {
  const lines = [
    `Pilot Document: ${input.filename} / sha256=${input.fileHash} / pages=${input.pageCount} / extraction=성공`,
    `Sample Range: p${input.sampleFromPage}-p${input.sampleToPage} (전수 분석 아님, 파일럿 표본)`,
    `Reference Items: detected=${input.detectedCount} / analyzed=${input.analyzedCount} / uncertain=${input.uncertainCount} / out-of-scope=${input.outOfScopeCount} / failed=${input.failedCount}`,
    `Curriculum Mapping: exact=${input.mappingTally.EXACT} / multi-node=${input.mappingTally.MULTI_NODE} / uncertain=${input.mappingTally.UNCERTAIN} / out-of-scope=${input.mappingTally.OUT_OF_SCOPE}`,
    `Curriculum Gap Candidates(코드): ${input.curriculumGapCodes.length > 0 ? input.curriculumGapCodes.join(", ") : "없음"}`,
    `Family Candidates: count=${input.familyCount} / review-required=${input.familyReviewRequiredCount} / rejected=${input.familyRejectedCount} / duplicate-merged-groups=${input.duplicateMergedGroups}`,
    `Difficulty Reference Estimate: D1=${input.difficultyTally.D1 ?? 0} D2=${input.difficultyTally.D2 ?? 0} D3=${input.difficultyTally.D3 ?? 0} D4=${input.difficultyTally.D4 ?? 0} D5=${input.difficultyTally.D5 ?? 0} unclassified=${input.difficultyTally.UNKNOWN ?? 0}`,
    "Copyright Safety: raw text in production tables = NO, source usage_mode = REFERENCE_ONLY, license verification status = UNVERIFIED",
  ];
  console.log("\n" + lines.join("\n"));
}

// CLI로 직접 실행됐을 때만 파이프라인을 구동한다(테스트에서 순수 함수만 안전하게 import하기 위함).
const isDirectExecution =
  process.argv[1] !== undefined && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isDirectExecution) {
  main().catch((error: unknown) => {
    console.error("파일럿 파이프라인 실패", error);
    process.exitCode = 1;
  });
}
