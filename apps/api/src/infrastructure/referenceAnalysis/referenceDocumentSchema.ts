import { z } from "zod";
import { referenceSourceUsageModeSchema } from "../curriculum/referenceSourceSchema";

/** `reference_documents.license_status` 값. DB CHECK와 동일한 3개 상태. */
export const referenceDocumentLicenseStatusSchema = z.enum(["UNVERIFIED", "VERIFIED", "REJECTED"]);
export type ReferenceDocumentLicenseStatus = z.infer<typeof referenceDocumentLicenseStatusSchema>;

/**
 * `reference_documents` 테이블 한 행에 대응하는 입력 shape.
 * DB의 `reference_documents_license_verified_before_production` CHECK와 동일한 안전 불변식을
 * 애플리케이션 레벨에서도 한 번 더 검증한다(방어적 이중 검증, referenceSourceSchema와 동일 패턴).
 *
 * 이 스키마는 문항 원문을 담지 않는다 — 파일 메타데이터(해시/페이지 수/파서 버전 등)만 다룬다.
 */
export const referenceDocumentSchema = z
  .object({
    sourceId: z.string().min(1),
    documentKey: z.string().min(1),
    filename: z.string().min(1),
    subject: z.string().min(1),
    unit: z.string().nullable(),
    curriculumVersion: z.string().min(1),
    /** sha256 hex(64자 소문자 hex). 원문 자체는 저장하지 않는다. */
    fileHash: z
      .string()
      .regex(/^[0-9a-f]{64}$/, "fileHash는 sha256 hex(소문자 64자)여야 합니다."),
    pageCount: z.number().int().positive(),
    extractionVersion: z.string().min(1),
    parserVersion: z.string().min(1),
    usageMode: referenceSourceUsageModeSchema,
    licenseStatus: referenceDocumentLicenseStatusSchema,
    processedAt: z.string().nullable(),
  })
  .refine((value) => value.licenseStatus === "VERIFIED" || value.usageMode !== "PRODUCTION_ALLOWED", {
    message: "licenseStatus가 VERIFIED가 아닌 문서는 usageMode를 PRODUCTION_ALLOWED로 지정할 수 없습니다.",
    path: ["usageMode"],
  });
export type ReferenceDocumentInput = z.infer<typeof referenceDocumentSchema>;
