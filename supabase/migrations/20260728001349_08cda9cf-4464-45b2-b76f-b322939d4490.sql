
-- Extensions
create extension if not exists vector;
create extension if not exists pg_trgm;

-- Enums
create type public.app_role as enum ('user', 'admin');
create type public.document_status as enum ('draft', 'published', 'archived', 'superseded');
create type public.processing_status as enum ('uploaded', 'processing', 'ready', 'failed', 'ocr_required');
create type public.classification_level as enum ('demo', 'internal', 'restricted');
create type public.message_role as enum ('user', 'assistant');
create type public.answer_status as enum ('answered', 'partial', 'not_found', 'conflict', 'error');
create type public.confidence_level as enum ('high', 'medium', 'low');

-- Utility trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql
set search_path = public
as $$ begin new.updated_at = now(); return new; end $$;

-- profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  department text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "own profile read" on public.profiles for select to authenticated using (id = auth.uid());
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "own profile insert" on public.profiles for insert to authenticated with check (id = auth.uid());
create trigger profiles_updated before update on public.profiles for each row execute function public.set_updated_at();

-- user_roles
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null,
  created_at timestamptz not null default now(),
  unique(user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "read own roles" on public.user_roles for select to authenticated using (user_id = auth.uid());

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.user_roles where user_id = _user_id and role = _role) $$;

-- Trigger to auto-create profile + default user role on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name) values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''));
  insert into public.user_roles (user_id, role) values (new.id, 'user');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- documents
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  document_code text not null,
  category text not null,
  department text,
  version text not null,
  effective_date date,
  status document_status not null default 'draft',
  classification classification_level not null default 'demo',
  storage_path text not null,
  mime_type text not null,
  file_size bigint not null,
  checksum text not null,
  processing_status processing_status not null default 'uploaded',
  processing_error text,
  supersedes_document_id uuid references public.documents(id) on delete set null,
  uploaded_by uuid not null references auth.users(id) on delete restrict,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(document_code, version),
  unique(checksum)
);
create index documents_status_idx on public.documents(status, processing_status);
create index documents_code_idx on public.documents(document_code);
grant select, insert, update, delete on public.documents to authenticated;
grant all on public.documents to service_role;
alter table public.documents enable row level security;
create policy "auth read published" on public.documents for select to authenticated
  using (status = 'published' and processing_status = 'ready' or public.has_role(auth.uid(),'admin'));
create policy "admin write documents" on public.documents for insert to authenticated
  with check (public.has_role(auth.uid(),'admin'));
create policy "admin update documents" on public.documents for update to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create policy "admin delete documents" on public.documents for delete to authenticated
  using (public.has_role(auth.uid(),'admin'));
create trigger documents_updated before update on public.documents for each row execute function public.set_updated_at();

-- document_chunks
create table public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  chunk_index int not null,
  content text not null,
  page_start int,
  page_end int,
  section_title text,
  embedding vector(3072),
  search_vector tsvector generated always as (to_tsvector('portuguese', coalesce(content,''))) stored,
  created_at timestamptz not null default now(),
  unique(document_id, chunk_index)
);
create index chunks_embedding_idx on public.document_chunks
  using hnsw ((embedding::halfvec(3072)) halfvec_cosine_ops);
create index chunks_search_idx on public.document_chunks using gin(search_vector);
create index chunks_document_idx on public.document_chunks(document_id);
grant select, insert, update, delete on public.document_chunks to authenticated;
grant all on public.document_chunks to service_role;
alter table public.document_chunks enable row level security;
create policy "auth read chunks of published" on public.document_chunks for select to authenticated
  using (exists (select 1 from public.documents d where d.id = document_id
    and ((d.status = 'published' and d.processing_status = 'ready') or public.has_role(auth.uid(),'admin'))));
create policy "admin write chunks" on public.document_chunks for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- conversations
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Nova conversa',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index conversations_user_idx on public.conversations(user_id, updated_at desc);
grant select, insert, update, delete on public.conversations to authenticated;
grant all on public.conversations to service_role;
alter table public.conversations enable row level security;
create policy "own conversations" on public.conversations for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create trigger conversations_updated before update on public.conversations for each row execute function public.set_updated_at();

-- messages
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role message_role not null,
  content text not null,
  status answer_status,
  confidence confidence_level,
  citations jsonb not null default '[]'::jsonb,
  follow_up_suggestions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index messages_conversation_idx on public.messages(conversation_id, created_at);
grant select, insert, update, delete on public.messages to authenticated;
grant all on public.messages to service_role;
alter table public.messages enable row level security;
create policy "own messages" on public.messages for all to authenticated
  using (exists (select 1 from public.conversations c where c.id = conversation_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.conversations c where c.id = conversation_id and c.user_id = auth.uid()));

-- feedback
create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating smallint not null check (rating in (-1, 1)),
  comment text,
  created_at timestamptz not null default now(),
  unique(message_id, user_id)
);
grant select, insert, update, delete on public.feedback to authenticated;
grant all on public.feedback to service_role;
alter table public.feedback enable row level security;
create policy "own feedback rw" on public.feedback for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "admin read feedback" on public.feedback for select to authenticated
  using (public.has_role(auth.uid(),'admin'));

-- evaluation_cases
create table public.evaluation_cases (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  expected_behavior text not null,
  observed_behavior text,
  result text check (result in ('pass','fail','pending')) default 'pending',
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.evaluation_cases to authenticated;
grant all on public.evaluation_cases to service_role;
alter table public.evaluation_cases enable row level security;
create policy "admin manage evaluation" on public.evaluation_cases for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create trigger evaluation_updated before update on public.evaluation_cases for each row execute function public.set_updated_at();

-- audit_events
create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  resource_type text,
  resource_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_created_idx on public.audit_events(created_at desc);
grant select on public.audit_events to authenticated;
grant all on public.audit_events to service_role;
alter table public.audit_events enable row level security;
create policy "admin read audit" on public.audit_events for select to authenticated
  using (public.has_role(auth.uid(),'admin'));

-- usage_events (rate limiting)
create table public.usage_events (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  created_at timestamptz not null default now()
);
create index usage_user_time_idx on public.usage_events(user_id, created_at desc);
grant select, insert on public.usage_events to authenticated;
grant all on public.usage_events to service_role;
alter table public.usage_events enable row level security;
create policy "own usage read" on public.usage_events for select to authenticated using (user_id = auth.uid());
create policy "own usage insert" on public.usage_events for insert to authenticated with check (user_id = auth.uid());

-- Hybrid RAG search function
create or replace function public.match_document_chunks(
  query_embedding vector(3072),
  query_text text,
  match_count int default 12
)
returns table (
  id uuid,
  document_id uuid,
  chunk_index int,
  content text,
  page_start int,
  page_end int,
  section_title text,
  similarity float,
  text_rank float,
  document_title text,
  document_code text,
  document_version text
) language sql stable security definer set search_path = public
as $$
  select c.id, c.document_id, c.chunk_index, c.content, c.page_start, c.page_end, c.section_title,
    1 - (c.embedding::halfvec(3072) <=> query_embedding::halfvec(3072)) as similarity,
    coalesce(ts_rank(c.search_vector, plainto_tsquery('portuguese', query_text)), 0) as text_rank,
    d.title, d.document_code, d.version
  from public.document_chunks c
  join public.documents d on d.id = c.document_id
  where d.status = 'published' and d.processing_status = 'ready'
    and (d.effective_date is null or d.effective_date <= current_date)
    and c.embedding is not null
  order by c.embedding::halfvec(3072) <=> query_embedding::halfvec(3072)
  limit match_count;
$$;
