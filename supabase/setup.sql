-- Монитор Души: схема для синхронизации. Выполнить один раз в Supabase → SQL Editor → New query → Run.

-- Всё состояние приложения (тексты, задачи, архив сезонов) — один JSON-документ на пользователя.
create table if not exists public.app_state (
    user_id    uuid primary key references auth.users (id) on delete cascade,
    doc        jsonb not null,
    updated_at timestamptz not null default now()
);

alter table public.app_state enable row level security;

drop policy if exists "app_state_own" on public.app_state;
create policy "app_state_own" on public.app_state
    for all to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

-- Фото, видео и файлы. Приватный бакет, каждый пользователь видит только свою папку <user_id>/...
insert into storage.buckets (id, name, public, file_size_limit)
values ('media', 'media', false, 52428800)
on conflict (id) do nothing;

drop policy if exists "media_select_own" on storage.objects;
drop policy if exists "media_insert_own" on storage.objects;
drop policy if exists "media_update_own" on storage.objects;
drop policy if exists "media_delete_own" on storage.objects;

create policy "media_select_own" on storage.objects for select to authenticated
    using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "media_insert_own" on storage.objects for insert to authenticated
    with check (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "media_update_own" on storage.objects for update to authenticated
    using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text)
    with check (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "media_delete_own" on storage.objects for delete to authenticated
    using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
