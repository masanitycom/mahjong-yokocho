-- 卓のチャット（最新50件を部屋に保存）
alter table public.rooms add column if not exists chat jsonb not null default '[]'::jsonb;
