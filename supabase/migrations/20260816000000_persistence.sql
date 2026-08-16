-- 7단계: Supabase 영구 저장 스키마 (problems / solutions / chat_messages)
-- 적용 방법: Supabase 대시보드 > SQL Editor 에 이 파일 내용을 그대로 붙여넣어 실행한다.
-- (이 저장소에는 supabase CLI가 없으므로 파일만 관리하고 실행은 오너가 직접 한다.)

create table if not exists problems (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  grade text not null,
  input_type text not null check (input_type in ('photo', 'handwriting')),
  recognized_text text not null,
  recognized_latex text,
  created_at timestamptz not null default now()
);

create table if not exists solutions (
  id uuid primary key default gen_random_uuid(),
  problem_id uuid not null unique references problems(id) on delete cascade,
  concept_md text,
  solution_md text,
  answer_md text not null,
  concept_tags text[] not null default '{}',
  ai_provider text not null,
  ai_model text not null,
  created_at timestamptz not null default now()
);

create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  problem_id uuid not null references problems(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_problem_id_created_at_idx
  on chat_messages (problem_id, created_at);

alter table problems enable row level security;
alter table solutions enable row level security;
alter table chat_messages enable row level security;

create policy "problems_select_own" on problems
  for select using (auth.uid() = user_id);
create policy "problems_insert_own" on problems
  for insert with check (auth.uid() = user_id);

create policy "solutions_select_own" on solutions
  for select using (exists (select 1 from problems p where p.id = solutions.problem_id and p.user_id = auth.uid()));
create policy "solutions_insert_own" on solutions
  for insert with check (exists (select 1 from problems p where p.id = solutions.problem_id and p.user_id = auth.uid()));

create policy "chat_messages_select_own" on chat_messages
  for select using (exists (select 1 from problems p where p.id = chat_messages.problem_id and p.user_id = auth.uid()));
create policy "chat_messages_insert_own" on chat_messages
  for insert with check (exists (select 1 from problems p where p.id = chat_messages.problem_id and p.user_id = auth.uid()));
