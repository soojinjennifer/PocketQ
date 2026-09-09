-- 유저 플랜/무료체험 스키마 (profiles 테이블)
-- 적용 방법: Supabase 대시보드 > SQL Editor 에 이 파일 내용을 그대로 붙여넣어 실행한다.
-- (이 저장소에는 supabase CLI가 없으므로 파일만 관리하고 실행은 오너가 직접 한다.)
--
-- 이번 마이그레이션은 스키마(테이블/트리거/RLS)만 준비한다. `plan`/`trial_ends_at` 값을 읽어
-- 접근을 차단/안내하는 로직, 토스페이먼츠 연동, `plan`을 'paid'로 바꾸는 API는 이번 범위가
-- 아니다(오너 확정) — 추후 별도 작업에서 다룬다.
--
-- `grade`처럼 `auth.users.user_metadata`에 저장하지 않는 이유: user_metadata는 클라이언트가
-- `supabase.auth.updateUser()`로 직접 쓸 수 있다(`apps/web/src/features/grade-setup/useGradeSetup.ts`
-- 의 `grade` 저장 방식 참고). `plan`/`trial_ends_at`은 결제 상태를 좌우하는 값이라 사용자가
-- 직접 고칠 수 있으면 안 되므로, service role(서버, `apps/api`)만 쓸 수 있는 별도 테이블에 둔다
-- — INSERT/UPDATE/DELETE RLS 정책을 의도적으로 만들지 않는 것도 같은 이유다(아래 참고).

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'trial' check (plan in ('trial', 'paid', 'expired')),
  trial_ends_at timestamptz not null,
  created_at timestamptz not null default now()
);

-- 신규 가입(auth.users insert) 시 자동으로 profiles 행을 만든다. 15일 무료체험(오너 확정) 종료
-- 시각을 가입 시각(now()) 기준으로 미리 계산해 저장한다.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, trial_ends_at)
  values (new.id, now() + interval '15 days');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table profiles enable row level security;

-- 인증된 사용자가 자기 자신의 행만 조회할 수 있다. INSERT/UPDATE/DELETE 정책은 만들지 않는다 —
-- 서버(`apps/api`)가 항상 service role 키로만 쓰고(RLS 우회), 클라이언트가 plan/trial_ends_at을
-- 직접 쓸 수 있어서는 안 되기 때문이다(위 설명 참고).
create policy "profiles_select_own" on profiles
  for select using (auth.uid() = id);
