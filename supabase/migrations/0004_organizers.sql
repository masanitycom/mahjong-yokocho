-- 主催者コードと運営用の集計
-- 卓を立てる・グループを作るには「主催者」になる必要がある。主催者には運営が発行したコードでなる。

-- プレイヤーの主催者情報
alter table public.profiles add column if not exists organizer_status text;        -- null=一般 / active=主催者 / suspended=停止中
alter table public.profiles add column if not exists organizer_since timestamptz;
alter table public.profiles add column if not exists organizer_code uuid;           -- 使ったコード
alter table public.profiles add column if not exists organizer_note text;           -- 運営メモ

-- 主催者コード
create table if not exists public.organizer_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text not null default '',        -- 誰に渡したか等のメモ
  max_uses int not null default 1,
  uses int not null default 0,
  expires_at timestamptz,
  revoked boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.organizer_codes enable row level security;

-- 卓・対局に主催者をひも付ける
alter table public.rooms add column if not exists organizer uuid references public.profiles(id) on delete set null;
alter table public.games add column if not exists organizer uuid references public.profiles(id) on delete set null;
create index if not exists games_organizer_idx on public.games(organizer, ended_at desc);
create index if not exists games_ended_idx on public.games(ended_at desc);

-- これまでの対局は、その卓を立てた人を主催者とみなす
update public.games g set organizer = r.host from public.rooms r where g.room_id = r.id and g.organizer is null;

-- すでにグループを作った人・卓を立てた人は、そのまま主催者として使えるようにする
update public.profiles set organizer_status = 'active', organizer_since = now()
where organizer_status is null
  and (id in (select owner from public.groups) or id in (select organizer from public.games where organizer is not null));
