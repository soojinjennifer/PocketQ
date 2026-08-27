import { z } from "zod";
import { referenceSourceUsageModeSchema } from "../curriculum/referenceSourceSchema";

/** `exam_reference_sets.exam_type` 값. DB CHECK와 동일한 5개 값. */
export const examTypeSchema = z.enum(["SAMPLE", "CSAT", "JUNE_MOCK", "SEPT_MOCK", "OTHER_MOCK"]);
export type ExamType = z.infer<typeof examTypeSchema>;

/**
 * 증거 등급(Evidence Tier). GOLD_2028_SAMPLE은 2028학년도 수능 예시문항(공식, 신교육과정
 * 첫 적용 표본)이고, SILVER_KICE는 역대 평가원 기출(현재 0건 — 2022 개정이 2028학년도부터
 * 처음 적용되는 새 체제라 완전 호환되는 과거 기출이 사실상 없음), REFERENCE_OTHER는 그 외
 * 참고용 시험지다.
 */
export const evidenceTierSchema = z.enum(["GOLD_2028_SAMPLE", "SILVER_KICE", "REFERENCE_OTHER"]);
export type EvidenceTier = z.infer<typeof evidenceTierSchema>;

/** `exam_reference_sets.license_status` 값. DB CHECK와 동일한 3개 상태. */
export const examReferenceSetLicenseStatusSchema = z.enum(["UNVERIFIED", "VERIFIED", "REJECTED"]);
export type ExamReferenceSetLicenseStatus = z.infer<typeof examReferenceSetLicenseStatusSchema>;

/**
 * `exam_reference_sets` 테이블 한 행에 대응하는 입력 shape.
 * DB의 `exam_reference_sets_license_verified_before_production` CHECK와 동일한 안전
 * 불변식을 애플리케이션 레벨에서도 한 번 더 검증한다(방어적 이중 검증, Stage 1/2와 동일 패턴).
 *
 * 이 스키마는 문항 원문을 담지 않는다 — 시험 메타데이터(연도/유형/증거 등급/파일 해시 등)만 다룬다.
 */
export const examReferenceSetSchema = z
  .object({
    sourceId: z.string().min(1),
    examCode: z.string().min(1),
    examType: examTypeSchema,
    examYear: z.number().int(),
    curriculumVersion: z.string().min(1),
    authority: z.string().min(1),
    evidenceTier: evidenceTierSchema,
    licenseStatus: examReferenceSetLicenseStatusSchema,
    usageMode: referenceSourceUsageModeSchema,
    documentKey: z.string().min(1).nullable(),
    filename: z.string().nullable(),
    fileHash: z
      .string()
      .regex(/^[0-9a-f]{64}$/, "fileHash는 sha256 hex(소문자 64자)여야 합니다.")
      .nullable(),
    pageCount: z.number().int().positive().nullable(),
    extractionVersion: z.string().nullable(),
    parserVersion: z.string().nullable(),
    processedAt: z.string().nullable(),
    isActive: z.boolean(),
  })
  .refine((value) => value.licenseStatus === "VERIFIED" || value.usageMode !== "PRODUCTION_ALLOWED", {
    message: "licenseStatus가 VERIFIED가 아닌 시험 참고자료는 usageMode를 PRODUCTION_ALLOWED로 지정할 수 없습니다.",
    path: ["usageMode"],
  });
export type ExamReferenceSetInput = z.infer<typeof examReferenceSetSchema>;
