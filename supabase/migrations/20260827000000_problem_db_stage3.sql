-- Problem DB Stage 3: CSAT Gold-Set Calibration & Problem Family Approval
-- (exam_reference_sets / exam_item_features / problem_family_evidence / problem_family_calibration)
-- 적용 방법: Supabase 대시보드 > SQL Editor 에 이 파일 내용을 그대로 붙여넣어 실행한다.
-- (이 저장소에는 supabase CLI가 없으므로 파일만 관리하고 실행은 오너가 직접 한다.)
--
-- 이 마이그레이션은 기존 problems/solutions/chat_messages, Stage 1 세 테이블
-- (reference_sources/curriculum_nodes/curriculum_prerequisites, 20260825000000_problem_db_stage1.sql),
-- Stage 2 세 테이블(reference_documents/reference_item_features/problem_family_candidates,
-- 20260826000000_problem_db_stage2.sql)을 전혀 건드리지 않는다. 네 테이블 모두
-- `create table if not exists`로 추가해 재실행해도 안전하다.
--
-- 저작권 안전 정책(중요): 아래 네 테이블 중 어디에도 문항 원문 전체를 담는 컬럼이 없다.
-- exam_item_features는 추상화된 구조적 특징(개념/추론 패턴/배점 등)만 저장한다.
--
-- 상태값 불변식(중요): problem_family_candidates.status(Stage 2, CANDIDATE/REVIEW_REQUIRED/
-- REJECTED 3값 고정)에는 절대 APPROVED를 쓰지 않는다 — 최종 승인 상태는 이 마이그레이션이
-- 새로 만드는 problem_family_calibration.status에만 존재한다.

create table if not exists exam_reference_sets (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references reference_sources(id) on delete restrict,
  -- 예: "KICE-2028-SAMPLE-MATH"
  exam_code text not null unique,
  exam_type text not null
    check (exam_type in ('SAMPLE', 'CSAT', 'JUNE_MOCK', 'SEPT_MOCK', 'OTHER_MOCK')),
  exam_year integer not null,
  curriculum_version text not null,
  authority text not null,
  evidence_tier text not null
    check (evidence_tier in ('GOLD_2028_SAMPLE', 'SILVER_KICE', 'REFERENCE_OTHER')),
  license_status text not null default 'UNVERIFIED'
    check (license_status in ('UNVERIFIED', 'VERIFIED', 'REJECTED')),
  usage_mode text not null default 'REFERENCE_ONLY'
    check (usage_mode in ('REFERENCE_ONLY', 'DERIVATIVE_ALLOWED', 'DISPLAY_ALLOWED', 'PRODUCTION_ALLOWED')),
  document_key text unique,
  filename text,
  file_hash text,
  page_count integer,
  extraction_version text,
  parser_version text,
  processed_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- 안전 불변식: 라이선스가 검증되지 않은 시험 참고자료는 프로덕션 사용 등급이 될 수 없다.
  constraint exam_reference_sets_license_verified_before_production
    check (license_status = 'VERIFIED' or usage_mode <> 'PRODUCTION_ALLOWED')
);

create index if not exists exam_reference_sets_source_id_idx on exam_reference_sets (source_id);

create table if not exists exam_item_features (
  id uuid primary key default gen_random_uuid(),
  exam_reference_set_id uuid not null references exam_reference_sets(id) on delete cascade,
  item_number integer not null check (item_number > 0),
  subject_mapping text not null
    check (subject_mapping in ('ALG', 'CALC1', 'OUT_OF_CURRENT_SCOPE')),
  curriculum_node_codes text[] not null default '{}',
  -- 원문 발췌 금지 — 추상화된 개념 서술만. 물리적 방어를 위해 길이를 제한한다.
  primary_concept text check (char_length(primary_concept) <= 200),
  secondary_concepts text[],
  required_skills text[],
  prerequisite_skills text[],
  representation_type text
    check (representation_type in (
      'expression', 'equation', 'inequality', 'graph', 'function_relation', 'word_situation', 'mixed'
    )),
  reasoning_signature text,
  reasoning_step_count smallint check (reasoning_step_count >= 0),
  calculation_load text check (calculation_load in ('LOW', 'MEDIUM', 'HIGH')),
  concept_load smallint check (concept_load >= 0),
  condition_interpretation_load text check (condition_interpretation_load in ('LOW', 'MEDIUM', 'HIGH')),
  case_split_required boolean not null default false,
  representation_conversion boolean not null default false,
  non_obvious_transformation boolean not null default false,
  answer_format text,
  -- 정답표의 배점(1~10점 사이). 원문 아닌 순수 숫자 메타데이터.
  official_point_value smallint check (official_point_value between 1 and 10),
  -- GOLD 항목이면서 subject_mapping='OUT_OF_CURRENT_SCOPE'면 null(현재 교육과정 범위 밖이라
  -- "현재 교육과정과의 호환성" 판정 자체가 의미 없음).
  curriculum_compatibility text
    check (curriculum_compatibility in ('DIRECT_COMPATIBLE', 'PARTIAL_COMPATIBLE', 'INCOMPATIBLE', 'UNCERTAIN')),
  extraction_confidence real check (extraction_confidence between 0 and 1),
  review_status text not null default 'NEEDS_REVIEW'
    check (review_status in ('NEEDS_REVIEW', 'REVIEWED_OK', 'REVIEWED_REJECTED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (exam_reference_set_id, item_number)
);

create index if not exists exam_item_features_exam_reference_set_id_idx
  on exam_item_features (exam_reference_set_id);

create table if not exists problem_family_evidence (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references problem_family_candidates(id) on delete restrict,
  exam_item_id uuid not null references exam_item_features(id) on delete cascade,
  -- NONE은 "매치 아님"을 뜻하며, 결정에 따라 실제로 이 테이블에 저장하지 않는다
  -- (비-증거를 증거 테이블에 넣지 않음. 애플리케이션 레벨에서 필터링).
  match_type text not null check (match_type in ('DIRECT', 'PARTIAL', 'COMPOSITE', 'WEAK', 'NONE')),
  structural_similarity real check (structural_similarity between 0 and 1),
  skill_overlap real check (skill_overlap between 0 and 1),
  reasoning_overlap real check (reasoning_overlap between 0 and 1),
  curriculum_compatibility text
    check (curriculum_compatibility in ('DIRECT_COMPATIBLE', 'PARTIAL_COMPATIBLE', 'INCOMPATIBLE', 'UNCERTAIN')),
  evidence_weight real not null check (evidence_weight between 0 and 1),
  notes text,
  created_at timestamptz not null default now(),
  unique (family_id, exam_item_id)
);

create index if not exists problem_family_evidence_family_id_idx on problem_family_evidence (family_id);
create index if not exists problem_family_evidence_exam_item_id_idx on problem_family_evidence (exam_item_id);

create table if not exists problem_family_calibration (
  family_id uuid primary key references problem_family_candidates(id) on delete restrict,
  csat_relevance_score real not null check (csat_relevance_score between 0 and 1),
  csat_relevance_level text not null check (csat_relevance_level in ('CORE', 'HIGH', 'MEDIUM', 'LOW', 'REJECT')),
  difficulty_center text check (difficulty_center in ('D1', 'D2', 'D3', 'D4', 'D5', 'UNKNOWN')),
  difficulty_min text check (difficulty_min in ('D1', 'D2', 'D3', 'D4', 'D5', 'UNKNOWN')),
  difficulty_max text check (difficulty_max in ('D1', 'D2', 'D3', 'D4', 'D5', 'UNKNOWN')),
  gold_evidence_count integer not null default 0 check (gold_evidence_count >= 0),
  silver_evidence_count integer not null default 0 check (silver_evidence_count >= 0),
  coverage_confidence real check (coverage_confidence between 0 and 1),
  -- 예: "stage3-v1"
  calibration_version text not null,
  calibrated_at timestamptz not null,
  -- 절대 이 테이블 밖(problem_family_candidates.status)에 APPROVED류 상태를 쓰지 않는다.
  -- production-approved 상태는 이 컬럼에만 존재한다.
  status text not null default 'CANDIDATE' check (status in ('CANDIDATE', 'APPROVED', 'REVIEW_REQUIRED', 'REJECTED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- difficulty_min <= difficulty_max 순서 검증은 DB CHECK가 아니라 애플리케이션 레벨
-- (problemFamilyCalibrationSchema.ts) zod `.refine()`에서만 강제한다(Stage 2와 동일 이유 —
-- D1~D5/UNKNOWN enum 순서는 Postgres CHECK로 자연스럽게 표현할 수 없음).

alter table exam_reference_sets enable row level security;
alter table exam_item_features enable row level security;
alter table problem_family_evidence enable row level security;
alter table problem_family_calibration enable row level security;

-- 정책은 의도적으로 추가하지 않는다 — service role(백엔드 API)만 접근 가능하고
-- anon/authenticated 클라이언트는 RLS에 막혀 직접 접근할 수 없다(API 경유만 허용, 기본값).
