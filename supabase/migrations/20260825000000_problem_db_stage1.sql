-- Problem DB Stage 1: 참고자료 → 교육과정 지도 데이터 기반 스키마
-- (reference_sources / curriculum_nodes / curriculum_prerequisites)
-- 적용 방법: Supabase 대시보드 > SQL Editor 에 이 파일 내용을 그대로 붙여넣어 실행한다.
-- (이 저장소에는 supabase CLI가 없으므로 파일만 관리하고 실행은 오너가 직접 한다.)
--
-- 이 마이그레이션은 기존 problems/solutions/chat_messages 테이블을 전혀 건드리지 않는다
-- (20260816000000_persistence.sql 참고). 세 테이블 모두 `create table if not exists`로
-- 추가해 재실행해도 안전하다.

create table if not exists reference_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  publisher text,
  source_url text not null unique,
  -- source_type은 DB CHECK로 고정하지 않는다. 자유 텍스트 + 코드 레벨 allow-list
  -- (apps/api/src/infrastructure/curriculum/referenceSourceSchema.ts)로 관리한다.
  source_type text not null,
  -- 하나의 참고자료가 여러 과목을 다룰 수 있어 배열로 관리한다(예: 대수+미적분Ⅰ).
  subject text[] not null default '{}',
  curriculum_version text not null,
  license_type text,
  license_url text,
  license_verified boolean not null default false,
  usage_mode text not null default 'REFERENCE_ONLY'
    check (usage_mode in ('REFERENCE_ONLY', 'DERIVATIVE_ALLOWED', 'DISPLAY_ALLOWED', 'PRODUCTION_ALLOWED')),
  attribution_text text,
  retrieved_at timestamptz not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- 안전 불변식: 라이선스가 검증되지 않은 소스는 프로덕션 사용 등급이 될 수 없다.
  -- 미검증 참고자료가 실수로 PRODUCTION_ALLOWED로 승격되는 것을 DB 레벨에서 물리적으로 차단한다.
  constraint reference_sources_license_verified_before_production
    check (license_verified = true or usage_mode <> 'PRODUCTION_ALLOWED')
);

create table if not exists curriculum_nodes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  subject text not null,
  node_type text not null check (node_type in ('SUBJECT', 'UNIT', 'SUBUNIT', 'CONCEPT', 'SKILL')),
  -- SUBJECT 노드만 parent_id가 null이다(트리 루트). 이 관계 자체는 DB CHECK가 아니라
  -- 애플리케이션 레벨(validateCurriculumGraph)에서 검증한다.
  parent_id uuid references curriculum_nodes(id) on delete restrict,
  name text not null,
  description text,
  curriculum_version text not null,
  -- 1~5 정수 스케일(임시). Stage 1 콘텐츠에서는 대부분 null.
  csat_importance smallint check (csat_importance between 1 and 5),
  difficulty_base smallint check (difficulty_base between 1 and 5),
  allowed_scope text,
  forbidden_scope text,
  -- Stage 1에서는 전부 null(교육과정 트리 자체는 특정 참고자료 고유 콘텐츠가 아님).
  source_id uuid references reference_sources(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists curriculum_nodes_parent_id_idx on curriculum_nodes (parent_id);
create index if not exists curriculum_nodes_subject_idx on curriculum_nodes (subject);

create table if not exists curriculum_prerequisites (
  node_id uuid not null references curriculum_nodes(id) on delete cascade,
  prerequisite_node_id uuid not null references curriculum_nodes(id) on delete cascade,
  strength text not null default 'required' check (strength in ('required', 'recommended', 'optional')),
  notes text,
  created_at timestamptz not null default now(),
  primary key (node_id, prerequisite_node_id),
  constraint curriculum_prerequisites_no_self_reference check (node_id <> prerequisite_node_id)
);

alter table reference_sources enable row level security;
alter table curriculum_nodes enable row level security;
alter table curriculum_prerequisites enable row level security;

-- 정책은 의도적으로 추가하지 않는다 — service role(백엔드 API)만 접근 가능하고
-- anon/authenticated 클라이언트는 RLS에 막혀 직접 접근할 수 없다(API 경유만 허용, 기본값).
