import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import {
  createExamCalibrationRepository,
  ExamCalibrationRepositoryError,
} from "./examCalibrationRepository";
import type { ExamItemFeatureInput } from "./examItemFeatureSchema";
import type { ExamReferenceSetInput } from "./examReferenceSetSchema";
import type { ProblemFamilyCalibrationInput } from "./problemFamilyCalibrationSchema";
import type { ProblemFamilyEvidenceInput } from "./problemFamilyEvidenceSchema";

interface ChainStep {
  method: string;
  args: unknown[];
}

interface RecordedCall {
  table: string;
  chain: ChainStep[];
}

/** `referenceAnalysisRepository.test.ts`의 가짜 Supabase 클라이언트 패턴을 그대로 재사용한다. */
function createFakeClient(resolveResult: (table: string, chain: ChainStep[]) => { data?: unknown; error?: unknown }) {
  const calls: RecordedCall[] = [];

  function makeBuilder(table: string, chain: ChainStep[]) {
    function step(method: string) {
      return (...args: unknown[]) => makeBuilder(table, [...chain, { method, args }]);
    }

    return {
      upsert: step("upsert"),
      select: step("select"),
      eq: step("eq"),
      then: (
        onFulfilled: (value: { data?: unknown; error?: unknown }) => unknown,
        onRejected?: (reason: unknown) => unknown,
      ) => {
        calls.push({ table, chain });
        return Promise.resolve(resolveResult(table, chain)).then(onFulfilled, onRejected);
      },
    };
  }

  const client = { from: (table: string) => makeBuilder(table, []) };
  return { client: client as unknown as SupabaseClient, calls };
}

const EXAM_REFERENCE_SET: ExamReferenceSetInput = {
  sourceId: "source-1",
  examCode: "KICE-2028-SAMPLE-MATH",
  examType: "SAMPLE",
  examYear: 2028,
  curriculumVersion: "2022",
  authority: "한국교육과정평가원",
  evidenceTier: "GOLD_2028_SAMPLE",
  licenseStatus: "UNVERIFIED",
  usageMode: "REFERENCE_ONLY",
  documentKey: "kice-2028-sample-math",
  filename: "테스트.pdf",
  fileHash: "b".repeat(64),
  pageCount: 13,
  extractionVersion: "stage3-v1",
  parserVersion: "pdfjs-dist@6.2.108",
  processedAt: "2026-08-27T00:00:00.000Z",
  isActive: true,
};

const EXAM_ITEM_FEATURE: ExamItemFeatureInput = {
  examReferenceSetId: "exam-set-1",
  itemNumber: 1,
  subjectMapping: "ALG",
  curriculumNodeCodes: ["ALG_EXP_LOG_EXP"],
  primaryConcept: "지수법칙 계산",
  secondaryConcepts: null,
  requiredSkills: ["exponent_rules"],
  prerequisiteSkills: null,
  representationType: "expression",
  reasoningSignature: "direct_exponent_law_application",
  reasoningStepCount: 1,
  calculationLoad: "LOW",
  conceptLoad: 1,
  conditionInterpretationLoad: "LOW",
  caseSplitRequired: false,
  representationConversion: false,
  nonObviousTransformation: false,
  answerFormat: "multiple_choice_5",
  officialPointValue: 2,
  curriculumCompatibility: "DIRECT_COMPATIBLE",
  extractionConfidence: 0.9,
  reviewStatus: "NEEDS_REVIEW",
};

const EVIDENCE: ProblemFamilyEvidenceInput = {
  familyId: "family-1",
  examItemId: "exam-item-1",
  matchType: "DIRECT",
  structuralSimilarity: 0.9,
  skillOverlap: 1,
  reasoningOverlap: 1,
  curriculumCompatibility: "DIRECT_COMPATIBLE",
  evidenceWeight: 1,
  notes: null,
};

const CALIBRATION: ProblemFamilyCalibrationInput = {
  familyId: "family-1",
  csatRelevanceScore: 0.9,
  csatRelevanceLevel: "CORE",
  difficultyCenter: "D2",
  difficultyMin: "D1",
  difficultyMax: "D3",
  goldEvidenceCount: 2,
  silverEvidenceCount: 0,
  coverageConfidence: 0.8,
  calibrationVersion: "stage3-v1",
  calibratedAt: "2026-08-27T00:00:00.000Z",
  status: "APPROVED",
};

describe("examCalibrationRepository", () => {
  describe("saveExamReferenceSet", () => {
    it("exam_reference_sets 테이블에 onConflict exam_code로 upsert하고 id를 반환한다", async () => {
      const { client, calls } = createFakeClient(() => ({ data: [{ id: "exam-set-1" }], error: null }));

      const id = await createExamCalibrationRepository(client).saveExamReferenceSet(EXAM_REFERENCE_SET);

      expect(id).toBe("exam-set-1");
      expect(calls[0]!.table).toBe("exam_reference_sets");
      expect(calls[0]!.chain[0]!.args[1]).toEqual({ onConflict: "exam_code" });
    });

    it("upsert 결과에 id가 없으면 던진다", async () => {
      const { client } = createFakeClient(() => ({ data: [], error: null }));
      await expect(
        createExamCalibrationRepository(client).saveExamReferenceSet(EXAM_REFERENCE_SET),
      ).rejects.toBeInstanceOf(ExamCalibrationRepositoryError);
    });

    it("Supabase가 error를 반환하면 던진다", async () => {
      const { client } = createFakeClient(() => ({ error: { message: "실패" } }));
      await expect(
        createExamCalibrationRepository(client).saveExamReferenceSet(EXAM_REFERENCE_SET),
      ).rejects.toBeInstanceOf(ExamCalibrationRepositoryError);
    });
  });

  describe("saveExamItemFeatures", () => {
    it("exam_item_features 테이블에 onConflict (exam_reference_set_id,item_number)로 upsert하고 id 매핑을 반환한다", async () => {
      const { client, calls } = createFakeClient(() => ({
        data: [{ id: "item-1", item_number: 1 }],
        error: null,
      }));

      const result = await createExamCalibrationRepository(client).saveExamItemFeatures([EXAM_ITEM_FEATURE]);

      expect(result).toEqual([{ itemNumber: 1, id: "item-1" }]);
      expect(calls[0]!.table).toBe("exam_item_features");
      expect(calls[0]!.chain[0]!.args[1]).toEqual({ onConflict: "exam_reference_set_id,item_number" });
      const rows = calls[0]!.chain[0]!.args[0] as Array<Record<string, unknown>>;
      expect(rows[0]).toMatchObject({ exam_reference_set_id: "exam-set-1", item_number: 1, subject_mapping: "ALG" });
    });

    it("빈 배열이면 Supabase를 호출하지 않는다", async () => {
      const { client, calls } = createFakeClient(() => ({ error: null }));
      const result = await createExamCalibrationRepository(client).saveExamItemFeatures([]);
      expect(result).toEqual([]);
      expect(calls).toHaveLength(0);
    });

    it("Supabase가 error를 반환하면 던진다", async () => {
      const { client } = createFakeClient(() => ({ error: { message: "실패" } }));
      await expect(
        createExamCalibrationRepository(client).saveExamItemFeatures([EXAM_ITEM_FEATURE]),
      ).rejects.toBeInstanceOf(ExamCalibrationRepositoryError);
    });
  });

  describe("saveProblemFamilyEvidence", () => {
    it("problem_family_evidence 테이블에 onConflict (family_id,exam_item_id)로 upsert한다", async () => {
      const { client, calls } = createFakeClient(() => ({ error: null }));

      await createExamCalibrationRepository(client).saveProblemFamilyEvidence([EVIDENCE]);

      expect(calls).toHaveLength(1);
      expect(calls[0]!.table).toBe("problem_family_evidence");
      expect(calls[0]!.chain[0]!.args[1]).toEqual({ onConflict: "family_id,exam_item_id" });
    });

    it("match_type이 NONE인 항목은 저장하지 않는다(방어적 필터링)", async () => {
      const { client, calls } = createFakeClient(() => ({ error: null }));

      await createExamCalibrationRepository(client).saveProblemFamilyEvidence([
        { ...EVIDENCE, matchType: "NONE", evidenceWeight: 0 },
      ]);

      expect(calls).toHaveLength(0);
    });

    it("빈 배열이면 Supabase를 호출하지 않는다", async () => {
      const { client, calls } = createFakeClient(() => ({ error: null }));
      await createExamCalibrationRepository(client).saveProblemFamilyEvidence([]);
      expect(calls).toHaveLength(0);
    });

    it("Supabase가 error를 반환하면 던진다", async () => {
      const { client } = createFakeClient(() => ({ error: { message: "실패" } }));
      await expect(
        createExamCalibrationRepository(client).saveProblemFamilyEvidence([EVIDENCE]),
      ).rejects.toBeInstanceOf(ExamCalibrationRepositoryError);
    });
  });

  describe("saveProblemFamilyCalibration", () => {
    it("problem_family_calibration 테이블에 onConflict family_id로 upsert한다", async () => {
      const { client, calls } = createFakeClient(() => ({ error: null }));

      await createExamCalibrationRepository(client).saveProblemFamilyCalibration([CALIBRATION]);

      expect(calls).toHaveLength(1);
      expect(calls[0]!.table).toBe("problem_family_calibration");
      expect(calls[0]!.chain[0]!.args[1]).toEqual({ onConflict: "family_id" });
      const rows = calls[0]!.chain[0]!.args[0] as Array<Record<string, unknown>>;
      expect(rows[0]).toMatchObject({ family_id: "family-1", status: "APPROVED" });
    });

    it("빈 배열이면 Supabase를 호출하지 않는다", async () => {
      const { client, calls } = createFakeClient(() => ({ error: null }));
      await createExamCalibrationRepository(client).saveProblemFamilyCalibration([]);
      expect(calls).toHaveLength(0);
    });

    it("Supabase가 error를 반환하면 던진다", async () => {
      const { client } = createFakeClient(() => ({ error: { message: "실패" } }));
      await expect(
        createExamCalibrationRepository(client).saveProblemFamilyCalibration([CALIBRATION]),
      ).rejects.toBeInstanceOf(ExamCalibrationRepositoryError);
    });
  });

  describe("findExamReferenceSetIdByCode", () => {
    it("행을 찾으면 id를 반환한다", async () => {
      const { client, calls } = createFakeClient(() => ({ data: [{ id: "exam-set-1" }], error: null }));

      const id = await createExamCalibrationRepository(client).findExamReferenceSetIdByCode("KICE-2028-SAMPLE-MATH");

      expect(id).toBe("exam-set-1");
      expect(calls[0]).toEqual({
        table: "exam_reference_sets",
        chain: [
          { method: "select", args: ["id"] },
          { method: "eq", args: ["exam_code", "KICE-2028-SAMPLE-MATH"] },
        ],
      });
    });

    it("행을 찾지 못하면 null을 반환한다(던지지 않음)", async () => {
      const { client } = createFakeClient(() => ({ data: [], error: null }));
      expect(await createExamCalibrationRepository(client).findExamReferenceSetIdByCode("UNKNOWN")).toBeNull();
    });

    it("Supabase가 error를 반환하면 던진다", async () => {
      const { client } = createFakeClient(() => ({ error: { message: "실패" } }));
      await expect(
        createExamCalibrationRepository(client).findExamReferenceSetIdByCode("KICE-2028-SAMPLE-MATH"),
      ).rejects.toBeInstanceOf(ExamCalibrationRepositoryError);
    });
  });

  describe("listExamItemFeaturesByExamReferenceSetId", () => {
    it("exam_reference_set_id로 필터링해 camelCase 매칭용 shape으로 변환한다", async () => {
      const dbRow = {
        id: "item-1",
        item_number: 1,
        subject_mapping: "ALG",
        curriculum_node_codes: ["ALG_EXP_LOG_EXP"],
        required_skills: ["exponent_rules"],
        reasoning_signature: "direct_exponent_law_simplification",
        representation_type: "expression",
        curriculum_compatibility: "DIRECT_COMPATIBLE",
        concept_load: 1,
        reasoning_step_count: 1,
        condition_interpretation_load: "LOW",
        calculation_load: "LOW",
        case_split_required: false,
        representation_conversion: true,
        non_obvious_transformation: false,
      };
      const { client, calls } = createFakeClient(() => ({ data: [dbRow], error: null }));

      const rows = await createExamCalibrationRepository(client).listExamItemFeaturesByExamReferenceSetId(
        "exam-set-1",
      );

      expect(calls[0]).toEqual({
        table: "exam_item_features",
        chain: [
          { method: "select", args: ["*"] },
          { method: "eq", args: ["exam_reference_set_id", "exam-set-1"] },
        ],
      });
      expect(rows).toEqual([
        {
          id: "item-1",
          itemNumber: 1,
          subjectMapping: "ALG",
          curriculumNodeCodes: ["ALG_EXP_LOG_EXP"],
          requiredSkills: ["exponent_rules"],
          reasoningSignature: "direct_exponent_law_simplification",
          representationType: "expression",
          curriculumCompatibility: "DIRECT_COMPATIBLE",
          conceptLoad: 1,
          reasoningStepCount: 1,
          conditionInterpretationLoad: "LOW",
          calculationLoad: "LOW",
          caseSplitRequired: false,
          representationConversion: true,
          nonObviousTransformation: false,
        },
      ]);
    });

    it("Supabase가 error를 반환하면 던진다", async () => {
      const { client } = createFakeClient(() => ({ error: { message: "실패" } }));
      await expect(
        createExamCalibrationRepository(client).listExamItemFeaturesByExamReferenceSetId("exam-set-1"),
      ).rejects.toBeInstanceOf(ExamCalibrationRepositoryError);
    });
  });

  describe("hasAnyExamReferenceSetWithEvidenceTier", () => {
    it("행이 있으면 true를 반환한다", async () => {
      const { client, calls } = createFakeClient(() => ({ data: [{ id: "silver-1" }], error: null }));
      expect(await createExamCalibrationRepository(client).hasAnyExamReferenceSetWithEvidenceTier("SILVER_KICE")).toBe(
        true,
      );
      expect(calls[0]!.chain[1]).toEqual({ method: "eq", args: ["evidence_tier", "SILVER_KICE"] });
    });

    it("행이 없으면 false를 반환한다", async () => {
      const { client } = createFakeClient(() => ({ data: [], error: null }));
      expect(await createExamCalibrationRepository(client).hasAnyExamReferenceSetWithEvidenceTier("SILVER_KICE")).toBe(
        false,
      );
    });

    it("Supabase가 error를 반환하면 던진다", async () => {
      const { client } = createFakeClient(() => ({ error: { message: "실패" } }));
      await expect(
        createExamCalibrationRepository(client).hasAnyExamReferenceSetWithEvidenceTier("SILVER_KICE"),
      ).rejects.toBeInstanceOf(ExamCalibrationRepositoryError);
    });
  });
});
