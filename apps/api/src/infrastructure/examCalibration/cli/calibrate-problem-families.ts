import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { resolveRepoPath, loadCurriculumSource } from "../../curriculum/loadCurriculumSource";
import { buildCurriculumNodeIndex, classifyCurriculumMapping } from "../../referenceAnalysis/curriculumMapping";
import { groupItemsIntoFamilies } from "../../referenceAnalysis/familyGrouping";
import { segmentPageIntoItems } from "../../referenceAnalysis/itemSegmentation";
import { extractPageText } from "../../referenceAnalysis/pdf/extractPageText";
import { extractPdfMetadata } from "../../referenceAnalysis/pdf/extractPdfMetadata";
import type { ProblemFamilyCandidateInput } from "../../referenceAnalysis/problemFamilyCandidateSchema";
import { referenceAnalysisRepository } from "../../referenceAnalysis/referenceAnalysisRepository";
import {
  buildFamilyCandidate,
  enrichItem,
  selectInScopeItems,
} from "../../referenceAnalysis/cli/extract-reference-pilot";
import {
  calculationLoadSchema,
  representationTypeSchema,
} from "../../referenceAnalysis/referenceItemFeatureSchema";
import { computeCurriculumCentrality, type CurriculumCentralitySource } from "../curriculumCentrality";
import { examCalibrationRepository, type ExamItemFeatureForMatching } from "../examCalibrationRepository";
import type { CurriculumCompatibility } from "../examItemFeatureSchema";
import type { EvidenceTier } from "../examReferenceSetSchema";
import { problemFamilyCalibrationSchema } from "../problemFamilyCalibrationSchema";
import { problemFamilyEvidenceSchema } from "../problemFamilyEvidenceSchema";
import {
  buildMergeProposalInputs,
  buildSplitProposalInputs,
  computeCoverageMetrics,
  computeFamilyCalibration,
  detectMergeProposals,
  detectSplitProposals,
  type CalibrationExamItemInput,
  type FamilyCalibrationComputation,
} from "./calibrateProblemFamilies.core";
import { loadGoldDataset, type GoldDataset } from "./ingest-gold-set";

/**
 * Problem DB Stage 3 메인 오케스트레이션.
 *
 * 저작권 안전 정책(중요): PDF 텍스트 추출은 Stage 2와 동일하게 로컬 `pdfjs-dist`만 사용하며
 * (`extractPageText`/`extractPdfMetadata` 재사용), 문항 원문/페이지 이미지를 OpenAI/Anthropic
 * 등 외부 AI API로 전송하지 않는다(`apps/api/src/infrastructure/ai/`의 `LLMAdapter`를 이
 * 파이프라인 어디에서도 import하지 않는다). Gold Set 문항 특징은 개발자가 PDF를 직접 열람해
 * 수동으로 큐레이션한 `gold-item-features.json`에서만 가져온다.
 */
const STAGE2_ENTRY = {
  documentKey: "mathjk-alg-explog-01",
  relativePdfPath: "data/references/mathjk/algebra/수악중독 유형 - 대수 - 1. 지수함수와 로그함수.pdf",
  curatedFeaturesPath: "data/references/mathjk/algebra/pilot-item-features.json",
  curriculumSourceRelativePath: "data/math-curriculum/algebra.v1.json",
} as const;
const SAMPLE_FROM_PAGE = 1;
const SAMPLE_TO_PAGE = 30;

const CALIBRATION_VERSION = "stage3-v1";

// Stage 2 `extract-reference-pilot.ts`와 동일한 큐레이션 아티팩트 shape을 다시 정의한다
// (`validate-reference-features.ts`와 동일한 "검증/재계산 스크립트는 자체 스키마 사본을 갖는다" 패턴).
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

interface CliOptions {
  apply: boolean;
}

function parseCliOptions(argv: string[]): CliOptions {
  return { apply: argv.includes("--apply") };
}

interface RecomputedStage2 {
  families: ProblemFamilyCandidateInput[];
  totalInScopeItemCount: number;
}

/**
 * Stage 2 파일럿 파이프라인을 인메모리로 재계산한다(export된 Stage 2 함수만 재사용, 로직은
 * 한 글자도 바꾸지 않음). DB에는 아무것도 쓰지 않는다.
 */
async function recomputeStage2FamilyCandidates(): Promise<RecomputedStage2> {
  const pdfPath = resolveRepoPath(STAGE2_ENTRY.relativePdfPath);
  const metadata = await extractPdfMetadata(pdfPath);
  const toPage = Math.min(SAMPLE_TO_PAGE, metadata.pageCount);
  const pages = await extractPageText(pdfPath, { fromPage: SAMPLE_FROM_PAGE, toPage });
  const segmentationByPage = new Map(pages.map((page) => [page.pageNumber, segmentPageIntoItems(page)]));

  const rawDataset: unknown = JSON.parse(readFileSync(resolveRepoPath(STAGE2_ENTRY.curatedFeaturesPath), "utf-8"));
  const dataset = pilotDatasetSchema.parse(rawDataset);

  const { source: curriculumSource } = loadCurriculumSource(STAGE2_ENTRY.curriculumSourceRelativePath);
  const curriculumNodesByCode = buildCurriculumNodeIndex(curriculumSource);

  const documentKey = dataset.document.documentKey;
  const enrichedItems = dataset.items.map((item) => enrichItem(item, documentKey, segmentationByPage));

  const curriculumClassifications = enrichedItems.map((item) =>
    classifyCurriculumMapping(item.draft.curriculumNodeCodes, curriculumNodesByCode),
  );
  const inScopeItems = selectInScopeItems(enrichedItems, curriculumClassifications);

  const groups = groupItemsIntoFamilies(
    inScopeItems.map((item) => ({
      localItemKey: item.localItemKey,
      primaryConcept: item.draft.primaryConcept,
      reasoningPattern: item.draft.reasoningPattern,
      representationType: item.draft.representationType,
      requiredSkills: item.draft.requiredSkills,
      conditionCount: item.draft.conditionCount,
    })),
  );

  const families = groups.map((group, index) =>
    buildFamilyCandidate(group, index, inScopeItems, dataset.document.subject, dataset.document.unit),
  );

  return { families, totalInScopeItemCount: inScopeItems.length };
}

function toCalibrationExamItem(
  item: GoldDataset["items"][number],
  examItemId: string,
  evidenceTier: EvidenceTier,
): CalibrationExamItemInput {
  return {
    examItemId,
    itemNumber: item.itemNumber,
    evidenceTier,
    curriculumNodeCodes: item.curriculumNodeCodes,
    requiredSkills: item.requiredSkills ?? [],
    reasoningSignature: item.reasoningSignature,
    representationType: item.representationType,
    curriculumCompatibility: item.curriculumCompatibility,
    conceptLoad: item.conceptLoad,
    reasoningStepCount: item.reasoningStepCount,
    conditionInterpretationLoad: item.conditionInterpretationLoad,
    calculationLoad: item.calculationLoad,
    caseSplitRequired: item.caseSplitRequired,
    representationConversion: item.representationConversion,
    nonObviousTransformation: item.nonObviousTransformation,
  };
}

interface RightsSafetySummary {
  mathjkUsageMode: string;
  kiceUsageMode: string;
  licenseUnresolvedCount: number;
}

function loadRightsSafetySummary(): RightsSafetySummary {
  const mathjkSource = JSON.parse(
    readFileSync(resolveRepoPath("data/references/mathjk/source.json"), "utf-8"),
  ) as { usageMode: string; licenseVerified: boolean };
  const kiceSource = JSON.parse(readFileSync(resolveRepoPath("data/references/kice/source.json"), "utf-8")) as {
    usageMode: string;
    licenseVerified: boolean;
  };

  const licenseUnresolvedCount = [mathjkSource, kiceSource].filter((source) => !source.licenseVerified).length;

  return { mathjkUsageMode: mathjkSource.usageMode, kiceUsageMode: kiceSource.usageMode, licenseUnresolvedCount };
}

async function main(): Promise<void> {
  const options = parseCliOptions(process.argv.slice(2));

  const goldDataset = loadGoldDataset();
  const { families, totalInScopeItemCount } = await recomputeStage2FamilyCandidates();

  const { source: algebra } = loadCurriculumSource("data/math-curriculum/algebra.v1.json");
  const { source: calculus1 } = loadCurriculumSource("data/math-curriculum/calculus1.v1.json");
  const combinedNodesByCode = new Map([
    ...buildCurriculumNodeIndex(algebra),
    ...buildCurriculumNodeIndex(calculus1),
  ]);
  const combinedPrerequisites = [...algebra.prerequisites, ...calculus1.prerequisites];

  const goldInScopeItems: CalibrationExamItemInput[] = goldDataset.items
    .filter((item) => item.subjectMapping !== "OUT_OF_CURRENT_SCOPE")
    .map((item) => toCalibrationExamItem(item, `gold#item-${item.itemNumber}`, "GOLD_2028_SAMPLE"));

  const hasAnySilverEvidenceInCorpus = false; // 결정사항: SILVER A(역대 평가원 기출) 현재 0건.
  // 결정사항: cross-node combinability 신호가 아직 없어 reasoning 차원은 0가중치로 재분배함.
  // 향후 신호가 생기면 true로 전환.
  const hasReliableReasoningReusabilitySignal = false;

  const duplicateFamilyCodeByCode = detectExactDuplicateFamilies(families);
  const curriculumCentralitySourceByFamilyCode = new Map<string, CurriculumCentralitySource>();

  const calibrations: FamilyCalibrationComputation[] = families.map((family) => {
    const curriculumNodeCodes = family.curriculumNodeCodes ?? [];
    const curriculumNodesValid =
      curriculumNodeCodes.length > 0 && curriculumNodeCodes.every((code) => combinedNodesByCode.has(code));

    const centrality = computeCurriculumCentrality(curriculumNodeCodes, combinedNodesByCode, combinedPrerequisites);
    curriculumCentralitySourceByFamilyCode.set(family.candidateCode, centrality.source);

    return computeFamilyCalibration(family, goldInScopeItems, {
      curriculumNodesValid,
      // hasConflictingRepresentationTypes는 더 이상 여기서 하드코딩하지 않는다 — 실제 매칭된
      // 증거들의 representationType을 비교해 computeFamilyCalibration 내부에서 계산한다
      // (detectConflictingRepresentationTypes 참고).
      duplicateOfAnotherFamilyCode: duplicateFamilyCodeByCode.get(family.candidateCode) ?? null,
      curriculumCentrality: centrality.value,
      referenceCoverageRatio:
        totalInScopeItemCount === 0 ? 0 : Math.min(1, family.sourceItemCount / totalInScopeItemCount),
      hasAnySilverEvidenceInCorpus,
      hasReliableReasoningReusabilitySignal,
    });
  });

  const mergeProposals = detectMergeProposals(buildMergeProposalInputs(families, calibrations));
  const examItemsById = new Map(goldInScopeItems.map((item) => [item.examItemId, item]));
  const splitProposals = detectSplitProposals(buildSplitProposalInputs(families, calibrations, examItemsById));

  const coverage = computeCoverageMetrics(families, calibrations, goldInScopeItems);
  const rightsSafety = loadRightsSafetySummary();

  printReport({
    goldDataset,
    families,
    calibrations,
    mergeProposals,
    splitProposals,
    coverage,
    rightsSafety,
    curriculumCentralitySourceByFamilyCode,
  });

  if (!options.apply) {
    console.log("\n(dry-run 모드입니다. 실제로 DB에 반영하려면 --apply 플래그를 추가하세요.)");
    return;
  }

  console.log("\n--apply 플래그가 지정되어 실제 DB에 반영합니다...");
  await applyToDatabase(calibrations);
}

/** 사실상 동일(동일 reasoningSignature + 동일 정렬된 curriculumNodeCodes)한 family를 찾는다. */
function detectExactDuplicateFamilies(families: ProblemFamilyCandidateInput[]): Map<string, string> {
  const keyOf = (family: ProblemFamilyCandidateInput): string =>
    `${family.reasoningSignature}::${[...(family.curriculumNodeCodes ?? [])].sort().join(",")}`;

  const firstCodeByKey = new Map<string, string>();
  const duplicateOf = new Map<string, string>();
  for (const family of families) {
    const key = keyOf(family);
    const existing = firstCodeByKey.get(key);
    if (existing) {
      duplicateOf.set(family.candidateCode, existing);
    } else {
      firstCodeByKey.set(key, family.candidateCode);
    }
  }
  return duplicateOf;
}

async function applyToDatabase(calibrations: FamilyCalibrationComputation[]): Promise<void> {
  const familyRows = await referenceAnalysisRepository.listProblemFamilyCandidates();
  const familyIdByCode = new Map(familyRows.map((row) => [row.candidateCode, row.id]));

  const examReferenceSetId = await examCalibrationRepository.findExamReferenceSetIdByCode("KICE-2028-SAMPLE-MATH");
  if (!examReferenceSetId) {
    console.error(
      "Gold Set(exam_reference_sets)이 아직 DB에 없습니다 — 먼저 `pnpm -F api exam:ingest-gold-set -- --apply`를 실행하세요.",
    );
    process.exitCode = 1;
    return;
  }
  const examItemRows = await examCalibrationRepository.listExamItemFeaturesByExamReferenceSetId(examReferenceSetId);
  const examItemIdByItemNumber = new Map(examItemRows.map((row) => [row.itemNumber, row]));

  let savedFamilyCount = 0;
  let skippedFamilyCount = 0;

  for (const calibration of calibrations) {
    const familyId = familyIdByCode.get(calibration.candidateCode);
    if (!familyId) {
      console.warn(
        `family(${calibration.candidateCode})가 아직 DB에 없어 건너뜁니다 — 먼저 reference:extract-pilot --apply를 실행하세요.`,
      );
      skippedFamilyCount += 1;
      continue;
    }

    const evidenceInputs = calibration.evidence
      .map((entry) => {
        const match = /^gold#item-(\d+)$/.exec(entry.examItemId);
        const itemNumber = match ? Number(match[1]) : null;
        const examItemRow: ExamItemFeatureForMatching | undefined =
          itemNumber !== null ? examItemIdByItemNumber.get(itemNumber) : undefined;
        if (!examItemRow) return null;

        return problemFamilyEvidenceSchema.parse({
          familyId,
          examItemId: examItemRow.id,
          matchType: entry.result.matchType,
          structuralSimilarity: entry.result.structuralSimilarity,
          skillOverlap: entry.result.skillOverlap,
          reasoningOverlap: entry.result.reasoningOverlap,
          curriculumCompatibility: examItemRow.curriculumCompatibility as CurriculumCompatibility | null,
          evidenceWeight: entry.result.evidenceWeight,
          notes: null,
        });
      })
      .filter((input): input is NonNullable<typeof input> => input !== null);

    await examCalibrationRepository.saveProblemFamilyEvidence(evidenceInputs);

    const calibrationInput = problemFamilyCalibrationSchema.parse({
      familyId,
      csatRelevanceScore: calibration.csat.score,
      csatRelevanceLevel: calibration.csat.level,
      difficultyCenter: calibration.difficultyBand.center,
      difficultyMin: calibration.difficultyBand.min,
      difficultyMax: calibration.difficultyBand.max,
      goldEvidenceCount: calibration.goldEvidenceCount,
      silverEvidenceCount: calibration.silverEvidenceCount,
      coverageConfidence: calibration.csat.dimensionScores.reference,
      calibrationVersion: CALIBRATION_VERSION,
      calibratedAt: new Date().toISOString(),
      status: calibration.approval.status,
    });
    await examCalibrationRepository.saveProblemFamilyCalibration([calibrationInput]);
    savedFamilyCount += 1;
  }

  console.log(`problem_family_evidence/problem_family_calibration upsert 완료: ${savedFamilyCount}개 family`);
  if (skippedFamilyCount > 0) {
    console.log(`DB에 없어 건너뛴 family: ${skippedFamilyCount}개`);
  }
}

interface PrintReportInput {
  goldDataset: GoldDataset;
  families: ProblemFamilyCandidateInput[];
  calibrations: FamilyCalibrationComputation[];
  mergeProposals: ReturnType<typeof detectMergeProposals>;
  splitProposals: ReturnType<typeof detectSplitProposals>;
  coverage: ReturnType<typeof computeCoverageMetrics>;
  rightsSafety: RightsSafetySummary;
  curriculumCentralitySourceByFamilyCode: ReadonlyMap<string, CurriculumCentralitySource>;
}

const DIFFICULTY_ORDER: Record<string, number> = { D1: 0, D2: 1, D3: 2, D4: 3, D5: 4 };

function printReport(input: PrintReportInput): void {
  const {
    goldDataset,
    families,
    calibrations,
    mergeProposals,
    splitProposals,
    coverage,
    rightsSafety,
    curriculumCentralitySourceByFamilyCode,
  } = input;

  const algCount = goldDataset.items.filter((item) => item.subjectMapping === "ALG").length;
  const calc1Count = goldDataset.items.filter((item) => item.subjectMapping === "CALC1").length;
  const outOfScopeCount = goldDataset.items.filter((item) => item.subjectMapping === "OUT_OF_CURRENT_SCOPE").length;
  const uncertainCount = goldDataset.items.filter((item) => item.curriculumCompatibility === "UNCERTAIN").length;

  const approvedCount = calibrations.filter((c) => c.approval.status === "APPROVED").length;
  const reviewRequiredCount = calibrations.filter((c) => c.approval.status === "REVIEW_REQUIRED").length;
  const rejectedCount = calibrations.filter((c) => c.approval.status === "REJECTED").length;

  const csatTally = { CORE: 0, HIGH: 0, MEDIUM: 0, LOW: 0, REJECT: 0 };
  for (const calibration of calibrations) {
    csatTally[calibration.csat.level] += 1;
  }

  const difficultyTally = { D1: 0, D2: 0, D3: 0, D4: 0, D5: 0 };
  for (const calibration of calibrations) {
    const { min, max } = calibration.difficultyBand;
    if (min === "UNKNOWN" || max === "UNKNOWN") continue;
    for (const level of Object.keys(difficultyTally) as Array<keyof typeof difficultyTally>) {
      if (DIFFICULTY_ORDER[min]! <= DIFFICULTY_ORDER[level]! && DIFFICULTY_ORDER[level]! <= DIFFICULTY_ORDER[max]!) {
        difficultyTally[level] += 1;
      }
    }
  }

  const lines = [
    `Gold Set: relevant=${algCount + calc1Count}(대수 ${algCount}/미적분Ⅰ ${calc1Count}) / out-of-current-scope=${outOfScopeCount} / uncertain=${uncertainCount}`,
    "Historical Evidence: total=0 / direct=0 / partial=0 / incompatible=0 / uncertain=0",
    `Family Calibration: reviewed=${calibrations.length} / approved=${approvedCount} / review-required=${reviewRequiredCount} / rejected=${rejectedCount} / merge-proposed=${mergeProposals.length} / split-proposed=${splitProposals.length}`,
    `CSAT Relevance: CORE=${csatTally.CORE} / HIGH=${csatTally.HIGH} / MEDIUM=${csatTally.MEDIUM} / LOW=${csatTally.LOW} / REJECT=${csatTally.REJECT}`,
    `Difficulty: D1-valid=${difficultyTally.D1} / D2-valid=${difficultyTally.D2} / D3-valid=${difficultyTally.D3} / D4-valid=${difficultyTally.D4} / D5-valid=${difficultyTally.D5} (한 family가 여러 레벨 걸칠 수 있음)`,
    `Coverage: Gold Family Coverage=${coverage.goldFamilyCoveragePercent}% / Gold Skill Coverage=${coverage.goldSkillCoveragePercent}% / Family Gap Count=${coverage.familyGapCount} / Unsupported Family Rate=${coverage.unsupportedFamilyRatePercent}%`,
    `Rights Safety: raw text in production tables=NO, MathJK usage_mode=${rightsSafety.mathjkUsageMode}, official source metadata recorded=YES, license unresolved items=${rightsSafety.licenseUnresolvedCount}`,
  ];

  console.log("\n" + lines.join("\n"));

  if (families.length > 0) {
    console.log("\n## Family 상세");
    for (const family of families) {
      const calibration = calibrations.find((c) => c.candidateCode === family.candidateCode)!;
      const centralitySource = curriculumCentralitySourceByFamilyCode.get(family.candidateCode) ?? "NEUTRAL_FALLBACK";
      console.log(
        ` - ${family.candidateCode}: status=${calibration.approval.status}, csat=${calibration.csat.level}(${calibration.csat.score}), ` +
          `difficulty=${calibration.difficultyBand.min}~${calibration.difficultyBand.max}, gold_evidence=${calibration.goldEvidenceCount}`,
      );
      console.log(
        `     gold_meaningful_evidence=${calibration.goldMeaningfulEvidenceCount}, ` +
          `curriculum_centrality=${calibration.csat.dimensionScores.curriculum}(${centralitySource})`,
      );
      for (const [gateName, gate] of Object.entries(calibration.approval.gates)) {
        if (gate.verdict !== "PASS") {
          console.log(`     [${gate.verdict}] ${gateName}: ${gate.reason}`);
        }
      }
    }
  }

  if (mergeProposals.length > 0) {
    console.log("\n## Merge Proposals(리포트 전용, 자동 병합 없음)");
    for (const proposal of mergeProposals) {
      console.log(` - ${proposal.familyCodeA} <-> ${proposal.familyCodeB}: ${proposal.reason}`);
    }
  }

  if (splitProposals.length > 0) {
    console.log("\n## Split Proposals(리포트 전용, 자동 분할 없음)");
    for (const proposal of splitProposals) {
      console.log(` - ${proposal.familyCode}: ${proposal.reason}`);
    }
  }
}

// CLI로 직접 실행됐을 때만 파이프라인을 구동한다(테스트에서 순수 함수만 안전하게 import하기 위함).
const isDirectExecution =
  process.argv[1] !== undefined && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isDirectExecution) {
  main().catch((error: unknown) => {
    console.error("Stage 3 calibration 파이프라인 실패", error);
    process.exitCode = 1;
  });
}
