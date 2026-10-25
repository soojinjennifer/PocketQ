-- 수풀잉 도형 시각화 Stage 5: solutions 행에 검증된 도형 명세를 저장하는 nullable 컬럼 추가
-- 적용 방법: Supabase 대시보드 > SQL Editor 에 이 파일 내용을 그대로 붙여넣어 실행한다.
-- (이 저장소에는 supabase CLI가 없으므로 파일만 관리하고 실행은 오너가 직접 한다.)
--
-- 비파괴 변경이다 — 기존 행·컬럼·정책을 바꾸지 않고 nullable 컬럼 4개와 check 2개만 더한다.
-- 모든 문장이 재실행 안전하다(`add column if not exists`, check는 이름으로 존재 여부를 확인한 뒤 추가).
--
-- 서버는 `FIGURES_PERSIST_ENABLED=true`이고 첫 사용 시 이 컬럼들을 탐지한 경우에만 읽고 쓴다
-- (`apps/api/src/infrastructure/persistence/problemRepository.ts`). 이 파일을 적용하기 전에는 플래그를 켜도
-- 텍스트 저장·조회가 기존과 같다. 적용 뒤에는 API 서버 재시작을 권장한다(탐지 결과 "사용 불가"는 5분 뒤 재탐지).
--
-- 컬럼 의미(`docs/FIGURE_SPEC.md` §8):
--   figures                 검증을 통과한 FigureSpec 배열(SSE `event: figures`로 보낸 최종 재파싱 결과와 동일, AI 원본 아님)
--   step_figure_refs        StepFigureRef 배열
--   figures_schema_version  저장 당시 FigureSpec schemaVersion(현재 1). 다른 값이면 재조회 시 도형만 버린다
--   figures_run_id          풀이 실행 식별자. 텍스트 upsert 때 새로 발급하고, 도형 update는 이 값이 같을 때만 반영한다
--                           (재풀이 뒤 늦게 끝난 이전 실행의 도형 쓰기를 막는다)

alter table solutions add column if not exists figures jsonb;
alter table solutions add column if not exists step_figure_refs jsonb;
alter table solutions add column if not exists figures_schema_version smallint;
alter table solutions add column if not exists figures_run_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'solutions_figures_is_array' and conrelid = 'public.solutions'::regclass
  ) then
    alter table solutions
      add constraint solutions_figures_is_array
      check (figures is null or jsonb_typeof(figures) = 'array');
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'solutions_step_figure_refs_is_array' and conrelid = 'public.solutions'::regclass
  ) then
    alter table solutions
      add constraint solutions_step_figure_refs_is_array
      check (step_figure_refs is null or jsonb_typeof(step_figure_refs) = 'array');
  end if;
end
$$;

-- PostgREST 스키마 캐시를 갱신한다(갱신 전에는 새 컬럼을 select/upsert하면 PGRST204·42703으로 거부된다).
notify pgrst, 'reload schema';

-- 롤백(오너 판단, 저장된 도형이 함께 사라진다 — 실행 전 백업 필요):
-- alter table solutions drop constraint if exists solutions_step_figure_refs_is_array;
-- alter table solutions drop constraint if exists solutions_figures_is_array;
-- alter table solutions drop column if exists figures_run_id;
-- alter table solutions drop column if exists figures_schema_version;
-- alter table solutions drop column if exists step_figure_refs;
-- alter table solutions drop column if exists figures;
-- notify pgrst, 'reload schema';
-- 롤백 전에 서버의 FIGURES_PERSIST_ENABLED를 먼저 끈다(켠 채로 컬럼을 지우면 탐지가 "사용 불가"로 바뀔 때까지 쓰기 1회가 실패 후 재시도된다).
