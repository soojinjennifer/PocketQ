-- Problem DB Stage 2: 파일럿 참고자료 분석 & 문제 패밀리 후보 추출
-- (reference_documents / reference_item_features / problem_family_candidates)
-- 적용 방법: Supabase 대시보드 > SQL Editor 에 이 파일 내용을 그대로 붙여넣어 실행한다.
-- (이 저장소에는 supabase CLI가 없으므로 파일만 관리하고 실행은 오너가 직접 한다.)
--
-- 이 마이그레이션은 기존 problems/solutions/chat_messages, Stage 1 세 테이블
-- (reference_sources/curriculum_nodes/curriculum_prerequisites, 20260825000000_problem_db_stage1.sql)을
-- 전혀 건드리지 않는다. 세 테이블 모두 `create table if not exists`로 추가해 재실행해도 안전하다.
--
-- 저작권 안전 정책(중요): 아래 세 테이블 중 어디에도 참고자료 문항의 원문 전체를 담는
-- 컬럼이 없다. reference_item_features는 추상화된 특징(개념/추론 패턴/난이도 등)만 저장하고,
-- problem_family_candidates.canonical_reasoning_steps는 원문 발췌가 아닌 추상화된 단계 서술만
-- 담는다(각 원소 200자 제한으로 물리적으로도 원문 전체 발췌를 어렵게 한다).

create table if not exists reference_documents (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references reference_sources(id) on delete restrict,
  -- 로마자 슬러그. 예: mathjk-alg-explog-01
  document_key text not null unique,
  filename text not null,
  subject text not null,
  unit text,
  curriculum_version text not null,
  -- sha256 hex. 파일 동일성 확인용(원문 자체는 저장하지 않는다).
  file_hash text not null,
  page_count integer not null check (page_count > 0),
  -- 예: "stage2-v1"
  extraction_version text not null,
  -- 예: "pdfjs-dist@6.2.108"
  parser_version text not null,
  usage_mode text not null default 'REFERENCE_ONLY'
    check (usage_mode in ('REFERENCE_ONLY', 'DERIVATIVE_ALLOWED', 'DISPLAY_ALLOWED', 'PRODUCTION_ALLOWED')),
  license_status text not null default 'UNVERIFIED'
    check (license_status in ('UNVERIFIED', 'VERIFIED', 'REJECTED')),
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- 안전 불변식: 라이선스가 검증되지 않은 문서는 프로덕션 사용 등급이 될 수 없다.
  constraint reference_documents_license_verified_before_production
    check (license_status = 'VERIFIED' or usage_mode <> 'PRODUCTION_ALLOWED')
);

create index if not exists reference_documents_source_id_idx on reference_documents (source_id);

create table if not exists reference_item_features (
  id uuid primary key default gen_random_uuid(),
  reference_document_id uuid not null references reference_documents(id) on delete cascade,
  -- 형식: {document_key}#p{페이지3자리}-i{순번2자리}, 예: mathjk-alg-explog-01#p002-i01
  local_item_key text not null,
  page_number integer not null check (page_number > 0),
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
  answer_format text,
  condition_count smallint check (condition_count >= 0),
  reasoning_pattern text,
  reasoning_step_count smallint check (reasoning_step_count >= 0),
  calculation_load text check (calculation_load in ('LOW', 'MEDIUM', 'HIGH')),
  concept_load smallint check (concept_load >= 0),
  transformation_pattern text[],
  graph_or_diagram_required boolean not null default false,
  -- 원문 발췌 금지 — 추상화된 함정 유형 서술만.
  common_trap_candidate text check (char_length(common_trap_candidate) <= 200),
  approximate_difficulty text not null default 'UNKNOWN'
    check (approximate_difficulty in ('D1', 'D2', 'D3', 'D4', 'D5', 'UNKNOWN')),
  family_signature text,
  extraction_confidence real check (extraction_confidence between 0 and 1),
  review_status text not null default 'NEEDS_REVIEW'
    check (review_status in ('NEEDS_REVIEW', 'REVIEWED_OK', 'REVIEWED_REJECTED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (reference_document_id, local_item_key)
);

create index if not exists reference_item_features_reference_document_id_idx
  on reference_item_features (reference_document_id);

create table if not exists problem_family_candidates (
  id uuid primary key default gen_random_uuid(),
  candidate_code text not null unique,
  subject text not null,
  unit text,
  curriculum_node_codes text[],
  family_name text not null,
  core_concept text not null,
  required_skills text[],
  reasoning_signature text not null,
  -- 원문 발췌 금지 — 각 원소는 추상화된 단계 서술만(길이 제한으로 물리적 방어).
  canonical_reasoning_steps text[],
  representation_types text[],
  prerequisite_nodes text[],
  approximate_difficulty_min text check (approximate_difficulty_min in ('D1', 'D2', 'D3', 'D4', 'D5', 'UNKNOWN')),
  approximate_difficulty_max text check (approximate_difficulty_max in ('D1', 'D2', 'D3', 'D4', 'D5', 'UNKNOWN')),
  source_item_count integer not null default 0 check (source_item_count >= 0),
  evidence_item_keys text[],
  confidence real check (confidence between 0 and 1),
  -- 절대 production-approved 상태를 표현하지 않는다(이 3개 값이 전부).
  status text not null default 'CANDIDATE' check (status in ('CANDIDATE', 'REVIEW_REQUIRED', 'REJECTED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- canonical_reasoning_steps 각 원소 길이 제한(200자)은 배열 CHECK로 표현할 수 없어
-- (Postgres는 배열 원소 단위 CHECK를 지원하지 않음) 애플리케이션 레벨
-- (problemFamilyCandidateSchema.ts)에서 강제한다. DB에는 방어적으로 남겨두지 않는다.

alter table reference_documents enable row level security;
alter table reference_item_features enable row level security;
alter table problem_family_candidates enable row level security;

-- 정책은 의도적으로 추가하지 않는다 — service role(백엔드 API)만 접근 가능하고
-- anon/authenticated 클라이언트는 RLS에 막혀 직접 접근할 수 없다(API 경유만 허용, 기본값).
