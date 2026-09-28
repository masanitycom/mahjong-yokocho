-- 麻雀横丁 初期スキーマ
-- すべてのテーブルは RLS を有効にし、ポリシーは作らない。
-- 読み書きはサーバー（Next.js の API、service_role キー）だけが行う。

create extension if not exists pgcrypto;

-- プレイヤー
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default 'ななし',
  avatar text,                        -- 160px の JPEG data URL（20KB 程度）
  lv int not null default 0,          -- 段位（0=初心一 … 15=魂天）
  rp int not null default 0,          -- 段位ポイント
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- グループ（身内の集まり）
create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,          -- 招待コード（6桁英数）
  owner uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member',  -- owner / member
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index if not exists group_members_user_idx on public.group_members(user_id);

-- 卓（対局中の部屋）
create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null,                 -- 4桁の入室コード（使用中の卓の中で一意）
  group_id uuid references public.groups(id) on delete set null,
  host uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'lobby',   -- lobby / playing / finished / closed
  rules jsonb not null,
  seats jsonb not null,               -- 4席: {userId|null, cpu, name, style}
  game jsonb,                         -- {seed, players, log, prompts, eventCount}
  views jsonb,                        -- 席ごとの画面データ（サーバーが計算して保存）
  version int not null default 0,
  game_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists rooms_code_active_idx on public.rooms(code) where status in ('lobby','playing','finished');

-- 終局した対局
create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references public.rooms(id) on delete set null,
  group_id uuid references public.groups(id) on delete set null,
  rules jsonb not null,
  players jsonb not null,             -- [{seat, userId|null, name, cpu}]
  results jsonb not null,             -- [{seat, rank, score, pt, yakitori}]
  hands jsonb not null,               -- 局ごとの記録（和了者・役・点数・流局）
  end_reason text,
  started_at timestamptz,
  ended_at timestamptz not null default now()
);
create index if not exists games_group_idx on public.games(group_id, ended_at desc);

-- 集計用：人間プレイヤーごとの成績
create table if not exists public.game_players (
  game_id uuid not null references public.games(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  group_id uuid references public.groups(id) on delete set null,
  seat int not null,
  rank int not null,
  score int not null,
  pt numeric(8,1) not null,
  wins int not null default 0,
  deal_ins int not null default 0,
  riichis int not null default 0,
  hands int not null default 0,
  best_total int,
  best_label text,
  ended_at timestamptz not null default now(),
  primary key (game_id, user_id)
);
create index if not exists game_players_user_idx on public.game_players(user_id, ended_at desc);
create index if not exists game_players_group_idx on public.game_players(group_id);

-- グループのランキング
create or replace view public.group_rankings as
select
  gp.group_id,
  gp.user_id,
  count(*)::int                          as games,
  sum(gp.pt)::numeric(10,1)              as total_pt,
  round(avg(gp.rank)::numeric, 2)        as avg_rank,
  sum((gp.rank = 1)::int)::int           as tops,
  sum((gp.rank = 4)::int)::int           as lasts,
  sum(gp.wins)::int                      as wins,
  sum(gp.deal_ins)::int                  as deal_ins,
  sum(gp.hands)::int                     as hands,
  max(gp.best_total)                     as best_total
from public.game_players gp
where gp.group_id is not null
group by gp.group_id, gp.user_id;

alter table public.profiles       enable row level security;
alter table public.groups         enable row level security;
alter table public.group_members  enable row level security;
alter table public.rooms          enable row level security;
alter table public.games          enable row level security;
alter table public.game_players   enable row level security;

-- ビューはサーバーからのみ参照（anon / authenticated からは見えない）
revoke all on public.group_rankings from anon, authenticated;
