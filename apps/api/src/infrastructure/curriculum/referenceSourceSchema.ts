import { z } from "zod";

/**
 * source_type의 코드 레벨 allow-list(결정사항 A). DB에는 CHECK 제약을 걸지 않고
 * 자유 텍스트로 두되, 여기 없는 값은 `isKnownReferenceSourceType`로 감지해
 * 임포트/검증 리포트에서 경고 용도로 쓸 수 있게 한다.
 */
export const KNOWN_REFERENCE_SOURCE_TYPES = [
  "blog_pdf_collection",
  "textbook",
  "past_exam",
  "official_sample_exam",
] as const;

export function isKnownReferenceSourceType(sourceType: string): boolean {
  return (KNOWN_REFERENCE_SOURCE_TYPES as readonly string[]).includes(sourceType);
}

/** `reference_sources.usage_mode` 값. DB CHECK와 동일한 4개 등급. */
export const referenceSourceUsageModeSchema = z.enum([
  "REFERENCE_ONLY",
  "DERIVATIVE_ALLOWED",
  "DISPLAY_ALLOWED",
  "PRODUCTION_ALLOWED",
]);
export type ReferenceSourceUsageMode = z.infer<typeof referenceSourceUsageModeSchema>;

/**
 * `data/references/**\/source.json` 매니페스트 shape이자 `reference_sources` 테이블
 * upsert 입력. DB의 `reference_sources_license_verified_before_production` CHECK와
 * 동일한 안전 불변식을 애플리케이션 레벨에서도 한 번 더 검증한다(방어적 이중 검증).
 */
export const referenceSourceSchema = z
  .object({
    name: z.string().min(1),
    publisher: z.string().nullable(),
    sourceUrl: z.string().url(),
    sourceType: z.string().min(1),
    subject: z.array(z.string().min(1)).min(1),
    curriculumVersion: z.string().min(1),
    licenseType: z.string().nullable(),
    licenseUrl: z.string().nullable(),
    licenseVerified: z.boolean(),
    usageMode: referenceSourceUsageModeSchema,
    attributionText: z.string().nullable(),
    retrievedAt: z.string().min(1),
    notes: z.string().nullable(),
  })
  .refine((value) => value.licenseVerified || value.usageMode !== "PRODUCTION_ALLOWED", {
    message: "licenseVerified가 false인 참고자료는 usageMode를 PRODUCTION_ALLOWED로 지정할 수 없습니다.",
    path: ["usageMode"],
  });
export type ReferenceSourceInput = z.infer<typeof referenceSourceSchema>;
