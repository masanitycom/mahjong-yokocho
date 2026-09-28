-- グループのシーズン（作成者が区切った開始時刻の一覧）
alter table public.groups add column if not exists seasons jsonb not null default '[]'::jsonb;
