-- ============================================================
-- Dreamcore 云数据库 Schema (Supabase PostgreSQL)
-- 使用方法：Supabase Dashboard → SQL Editor → 粘贴执行
-- 版本：v1.0 ｜ 2026-09-20
-- ============================================================

-- ---------- 用户资料（auth.users 托管认证） ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  avatar text,
  bio text,
  role text not null default 'user' check (role in ('user','artist','admin')),
  created_at timestamptz not null default now()
);

-- 新用户注册时自动建 profile（触发器）
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, username, avatar, bio)
  values (new.id, coalesce(new.raw_user_meta_data->>'username', '用户' || substr(new.id::text, 1, 6)),
          coalesce(new.raw_user_meta_data->>'avatar', ''),
          coalesce(new.raw_user_meta_data->>'bio', ''));
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- 作品 ----------
create table if not exists public.artworks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text default '',
  image_url text not null,
  tags text[] default '{}',
  category text default 'other',
  status text not null default 'published' check (status in ('draft','published','offline')),
  ai_scored boolean not null default false,
  like_count int not null default 0,
  view_count int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_artworks_user on public.artworks(user_id);
create index if not exists idx_artworks_created on public.artworks(created_at desc);
create index if not exists idx_artworks_tags on public.artworks using gin(tags);

-- ---------- AI评分（一对多，可重评） ----------
create table if not exists public.aesthetic_scores (
  id bigint generated always as identity primary key,
  artwork_id uuid not null references public.artworks(id) on delete cascade,
  user_id uuid references public.profiles(id),
  scores jsonb not null,
  total_score numeric(3,1) not null,
  grade text not null check (grade in ('sss','ss','s','a','b','c')),
  ai_description text default '',
  teaching_comments jsonb default '{}',
  model text default 'qwen-vl-plus',
  degraded boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_scores_artwork on public.aesthetic_scores(artwork_id, created_at desc);

-- ---------- 互动表 ----------
create table if not exists public.comments (
  id bigint generated always as identity primary key,
  artwork_id uuid not null references public.artworks(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  content text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_comments_artwork on public.comments(artwork_id, created_at desc);

create table if not exists public.likes (
  id bigint generated always as identity primary key,
  artwork_id uuid not null references public.artworks(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (artwork_id, user_id)
);

create table if not exists public.favorites (
  id bigint generated always as identity primary key,
  artwork_id uuid not null references public.artworks(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (artwork_id, user_id)
);

create table if not exists public.follows (
  id bigint generated always as identity primary key,
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (follower_id, following_id)
);

-- ---------- AI 数据表 ----------
create table if not exists public.edit_versions (
  id bigint generated always as identity primary key,
  artwork_id uuid references public.artworks(id) on delete cascade,
  user_id uuid references public.profiles(id),
  params jsonb not null default '{}',
  thumbnail text,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_crafts (
  id bigint generated always as identity primary key,
  artwork_id uuid references public.artworks(id) on delete set null,
  user_id uuid references public.profiles(id),
  craft_type text not null,
  style text,
  prompt text default '',
  result_url text,
  model text,
  created_at timestamptz not null default now()
);

create table if not exists public.tutor_sessions (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text default '新会话',
  messages jsonb not null default '[]',
  updated_at timestamptz not null default now()
);

create table if not exists public.curated_halls (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  theme text,
  artwork_ids uuid[] default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  payload jsonb default '{}',
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_notifications_user on public.notifications(user_id, created_at desc);

-- ---------- AI 调用成本统计（管理后台审计） ----------
create table if not exists public.ai_usage_log (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles(id),
  module text not null,          -- aesthetic/craft/tutor/curate/partner/edit
  provider text not null,        -- dashscope/deepseek/mimo/local-fallback
  model text,
  prompt_tokens int default 0,
  completion_tokens int default 0,
  success boolean not null default true,
  error text,
  created_at timestamptz not null default now()
);
create index if not exists idx_ai_usage_created on public.ai_usage_log(created_at desc);
create index if not exists idx_ai_usage_module on public.ai_usage_log(module);

-- ---------- 文化探索足迹表（v7 新增：识/懂/创 三行为点亮） ----------
create table if not exists public.culture_footprints (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  theme_id text not null,          -- 文化主题 id（dunhuang/sanxingdui/... 见 data/culture-knowledge.js）
  action text not null check (action in ('view', 'craft', 'scan')),
  source_artwork_id bigint,        -- 触发足迹的作品（view/craft 行为，可空）
  meta jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (user_id, theme_id, action)  -- 幂等点亮：同一行为只记一次
);
create index if not exists idx_culture_footprints_user on public.culture_footprints(user_id);
create index if not exists idx_culture_footprints_theme on public.culture_footprints(theme_id);

-- ============================================================
-- RLS 行级安全策略
-- ============================================================
alter table public.profiles enable row level security;
alter table public.artworks enable row level security;
alter table public.aesthetic_scores enable row level security;
alter table public.comments enable row level security;
alter table public.likes enable row level security;
alter table public.favorites enable row level security;
alter table public.follows enable row level security;
alter table public.edit_versions enable row level security;
alter table public.ai_crafts enable row level security;
alter table public.tutor_sessions enable row level security;
alter table public.curated_halls enable row level security;
alter table public.notifications enable row level security;
alter table public.ai_usage_log enable row level security;
alter table public.culture_footprints enable row level security;

-- profiles: 公开读，本人可改
create policy "profiles_select" on public.profiles for select using (true);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);

-- artworks: 公开读已发布，本人增删改
create policy "artworks_select_published" on public.artworks for select using (status = 'published' or user_id = auth.uid());
create policy "artworks_insert_own" on public.artworks for insert with check (auth.uid() = user_id);
create policy "artworks_update_own" on public.artworks for update using (auth.uid() = user_id);
create policy "artworks_delete_own" on public.artworks for delete using (auth.uid() = user_id);

-- aesthetic_scores: 公开读，登录可插入（评分记录绑定作品）
create policy "scores_select" on public.aesthetic_scores for select using (true);
create policy "scores_insert_auth" on public.aesthetic_scores for insert with check (auth.uid() is not null);

-- comments/likes/favorites: 公开读，本人写删
create policy "comments_select" on public.comments for select using (true);
create policy "comments_insert_own" on public.comments for insert with check (auth.uid() = user_id);
create policy "comments_delete_own" on public.comments for delete using (auth.uid() = user_id);
create policy "likes_select" on public.likes for select using (true);
create policy "likes_insert_own" on public.likes for insert with check (auth.uid() = user_id);
create policy "likes_delete_own" on public.likes for delete using (auth.uid() = user_id);
create policy "favorites_select" on public.favorites for select using (true);
create policy "favorites_insert_own" on public.favorites for insert with check (auth.uid() = user_id);
create policy "favorites_delete_own" on public.favorites for delete using (auth.uid() = user_id);

-- follows: 公开读，本人写删
create policy "follows_select" on public.follows for select using (true);
create policy "follows_insert_own" on public.follows for insert with check (auth.uid() = follower_id);
create policy "follows_delete_own" on public.follows for delete using (auth.uid() = follower_id);

-- 私有数据表: 本人读写
create policy "edit_versions_own" on public.edit_versions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "ai_crafts_select" on public.ai_crafts for select using (true);
create policy "ai_crafts_write_own" on public.ai_crafts for insert with check (auth.uid() = user_id);
create policy "tutor_sessions_own" on public.tutor_sessions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "curated_halls_select" on public.curated_halls for select using (true);
create policy "curated_halls_write_own" on public.curated_halls for insert with check (auth.uid() = user_id);
create policy "notifications_own" on public.notifications for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "ai_usage_insert_auth" on public.ai_usage_log for insert with check (auth.uid() is not null);
create policy "ai_usage_select_admin" on public.ai_usage_log for select using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- culture_footprints: 私有足迹数据，本人读写
create policy "culture_footprints_own" on public.culture_footprints for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- Storage Bucket（作品图片） ----------
insert into storage.buckets (id, name, public) values ('artworks', 'artworks', true)
  on conflict (id) do nothing;
