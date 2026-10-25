-- 수풀잉 도형 시각화 Stage 5: 이어풀기(resume) 결과 저장 테이블
-- 적용 방법: Supabase 대시보드 > SQL Editor 에 이 파일 내용을 그대로 붙여넣어 실행한다.
-- (이 저장소에는 supabase CLI가 없으므로 파일만 관리하고 실행은 오너가 직접 한다.)
--
-- 비파괴 변경이다 — 새 테이블 1개와 select 정책 1개만 만든다. 기존 problems/solutions/chat_messages는 건드리지 않는다.
-- 재실행 안전하다(`create table if not exists`, 정책은 `drop policy if exists` 후 다시 만든다).
--
-- 서버는 `RESUME_PERSIST_ENABLED=true`이고 첫 사용 시 이 테이블을 탐지한 경우에만 읽고 쓴다. 저장은 CAS 검증을
-- 통과한(verified = true) 결과만, 문제당 1행(problem_id unique) upsert로 한다 — 재실행·모드 변경 시 마지막 통과
-- 결과로 교체되고 도형은 null·figures_run_id는 새 값이 된다. 쓰기는 service role(서버)만 하므로 쓰기 정책은 만들지 않는다.
-- problems 삭제 시 on delete cascade로 함께 삭제된다(서버의 deleteProblems 코드는 바뀌지 않는다).
-- 적용 뒤에는 API 서버 재시작을 권장한다(탐지 결과 "사용 불가"는 5분 뒤 재탐지).
--
-- 주의(재작업 1, QA LOW-10): 이 파일은 `create table if not exists`라 **이 파일의 이전 버전을 이미 적용한 DB**에 다시 실행하면
-- 나중에 추가된 컬럼·제약(work_lines·last_valid_line·stall_line과 work 관련 check 3개)이 생기지 않는다. 그런 DB라면 별도
-- `alter table resume_solutions add column if not exists …` / `add constraint …`가 필요하다. 2026-10-25 현재 이 파일은 어느 DB에도
-- 적용되지 않았으므로 해당 없다(처음 적용하면 위 정의 전체가 한 번에 만들어진다).

create table if not exists resume_solutions (
  id uuid primary key default gen_random_uuid(),
  problem_id uuid not null unique references problems(id) on delete cascade,
  mode text not null check (mode in ('own', 'alternative')),
  method_name text not null,
  solution_md text not null,
  answer_md text not null,
  verified boolean not null,
  ai_provider text not null,
  ai_model text not null,
  figures jsonb,
  step_figure_refs jsonb,
  figures_schema_version smallint,
  figures_run_id uuid,
  -- 진단에 실제로 쓴 학생 풀이 줄 [{lineNo, latex}]와 진단 최소 근거 2값(계획 §12.1). 판정 배지는 화면이 같은 함수로 계산한다.
  -- 실질 상한은 서버가 검사한다: 50줄·줄당 500자·lines JSON UTF-8 32,768B(결정 필요, 임시값, `resumeWorkContextSchema`).
  -- DB 제약은 그보다 느슨한 안전망이다(50줄·jsonb 이진 크기 65,536B) — 기준(텍스트 vs jsonb 이진)이 달라 같은 값을 쓰면 경계에서
  -- 서버는 통과·DB는 거부할 수 있어 서버 상한이 항상 먼저 걸리도록 두 배로 둔다(재작업 1, QA LOW-7). 셋은 함께 null이거나 함께 값이 있다.
  work_lines jsonb,
  last_valid_line smallint,
  stall_line smallint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint resume_solutions_figures_is_array check (figures is null or jsonb_typeof(figures) = 'array'),
  constraint resume_solutions_refs_is_array check (step_figure_refs is null or jsonb_typeof(step_figure_refs) = 'array'),
  constraint resume_solutions_work_lines_shape check (
    work_lines is null or (jsonb_typeof(work_lines) = 'array'
      and jsonb_array_length(work_lines) <= 50
      and pg_column_size(work_lines) <= 65536)),
  constraint resume_solutions_work_context_all_or_none check (
    (work_lines is null and last_valid_line is null and stall_line is null)
    or (work_lines is not null and last_valid_line is not null)),
  constraint resume_solutions_line_range check (
    (last_valid_line is null or last_valid_line >= 0)
    and (stall_line is null or stall_line >= 1))
);

alter table resume_solutions enable row level security;

drop policy if exists "resume_solutions_select_own" on resume_solutions;
create policy "resume_solutions_select_own" on resume_solutions
  for select using (exists (select 1 from problems p where p.id = resume_solutions.problem_id and p.user_id = auth.uid()));

-- PostgREST 스키마 캐시를 갱신한다(갱신 전에는 이 테이블을 조회하면 PGRST205로 거부된다).
notify pgrst, 'reload schema';

-- 롤백(오너 판단, 저장된 이어풀기 결과가 함께 사라진다 — 실행 전 백업 필요):
-- 서버의 RESUME_PERSIST_ENABLED를 먼저 끈 뒤 실행한다.
-- drop table if exists resume_solutions;
-- notify pgrst, 'reload schema';
