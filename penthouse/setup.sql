-- Проект «Пентхаус»: схема для трекера уборки общаги. Выполнить один раз в Supabase → SQL Editor → New query → Run.
-- Повторный запуск безопасен: данные не трогает, только обновляет функции и правила.
-- Код общаги (по нему соседи вступают в комнаты) задаётся отдельной строкой, его нет в репозитории:
--   insert into public.dorm_secret (code) values ('ваш-код') on conflict do nothing;

-- Неделя ротации: 0 — неделя с понедельника 26.10.2026, время московское. Должно совпадать с EPOCH в app.js.
create or replace function public.dorm_week() returns int language sql stable as $$
    select floor(((now() at time zone 'Europe/Moscow')::date - date '2026-10-26') / 7.0)::int
$$;

-- Проверяющая комната недели: та, у которой зона ротации №4 (зона = (номер комнаты в списке + неделя) mod 5).
create or replace function public.dorm_checker(w int) returns int language sql immutable as $$
    select (array[70, 71, 72, 73, 74])[((4 - w) % 5 + 5) % 5 + 1]
$$;

create table if not exists public.dorm_secret (code text primary key);
alter table public.dorm_secret enable row level security;
-- политик нет: код не читается с сайта, его проверяет только dorm_join

create table if not exists public.dorm_members (
    user_id   uuid primary key references auth.users (id) on delete cascade,
    room      int  not null check (room in (70, 71, 72, 73, 74)),
    name      text not null check (char_length(name) between 1 and 40),
    joined_at timestamptz not null default now()
);
alter table public.dorm_members enable row level security;

create or replace function public.dorm_my_room() returns int language sql stable security definer set search_path = public as $$
    select room from dorm_members where user_id = auth.uid()
$$;

drop policy if exists "dorm_members_read" on public.dorm_members;
create policy "dorm_members_read" on public.dorm_members for select to authenticated
    using (user_id = auth.uid() or public.dorm_my_room() is not null);
-- вступление только через dorm_join: там код общаги и лимит мест в комнате

create or replace function public.dorm_join(p_room int, p_name text, p_code text) returns void
language plpgsql security definer set search_path = public as $$
begin
    if auth.uid() is null then raise exception 'Сначала войди'; end if;
    if not exists (select 1 from dorm_secret where code = trim(p_code)) then raise exception 'Неверный код общаги'; end if;
    if p_room not in (70, 71, 72, 73, 74) then raise exception 'Нет такой комнаты'; end if;
    if exists (select 1 from dorm_members where user_id = auth.uid()) then raise exception 'Комната уже выбрана'; end if;
    if (select count(*) from dorm_members where room = p_room) >= (case when p_room = 74 then 3 else 2 end) then
        raise exception 'В комнате % уже заняты все места', p_room;
    end if;
    insert into dorm_members (user_id, room, name) values (auth.uid(), p_room, trim(p_name));
end $$;
revoke all on function public.dorm_join(int, text, text) from public, anon;
grant execute on function public.dorm_join(int, text, text) to authenticated;

-- Все действия — только добавлением событий, менять и удалять их нельзя. Очки считает сайт из этой ленты.
--   claim    — комната отчиталась о деле (action), ждёт проверки
--   confirm  — проверяющие засчитали заявку ref, reject — отклонили (растущий штраф)
--   mess     — комната room пожаловалась на бардак комнаты target_room
--   purchase — худшая комната недели week купила вещь №item для пентхауса
create table if not exists public.dorm_events (
    id          bigint generated always as identity primary key,
    created_at  timestamptz not null default now(),
    user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
    room        int  not null,
    kind        text not null check (kind in ('claim', 'confirm', 'reject', 'mess', 'purchase')),
    action      text check (action in ('zone', 'trash', 'stove', 'foreign', 'bath')),
    target_room int,
    ref         bigint references public.dorm_events (id),
    item        int,
    week        int
);
create unique index if not exists dorm_events_one_verdict on public.dorm_events (ref) where kind in ('confirm', 'reject');
create unique index if not exists dorm_events_one_purchase on public.dorm_events (week) where kind = 'purchase';
alter table public.dorm_events enable row level security;

drop policy if exists "dorm_events_read" on public.dorm_events;
create policy "dorm_events_read" on public.dorm_events for select to authenticated
    using (public.dorm_my_room() is not null);
drop policy if exists "dorm_events_add" on public.dorm_events;
create policy "dorm_events_add" on public.dorm_events for insert to authenticated
    with check (public.dorm_my_room() is not null);

-- Правила, которые нельзя обойти из консоли браузера: комната берётся из аккаунта, свою заявку не проверить,
-- проверяет только комната на проверке этой недели.
create or replace function public.dorm_events_check() returns trigger
language plpgsql security definer set search_path = public as $$
declare
    my_room int := dorm_my_room();
    claim   dorm_events;
    checker int := dorm_checker(dorm_week());
begin
    if my_room is null then raise exception 'Сначала выбери комнату'; end if;
    new.user_id := auth.uid();
    new.room := my_room;
    new.created_at := now();

    if new.kind = 'claim' then
        if new.action is null then raise exception 'Не указано, что сделано'; end if;
        new.target_room := null; new.ref := null; new.item := null; new.week := null;

    elsif new.kind in ('confirm', 'reject') then
        select * into claim from dorm_events where id = new.ref and kind = 'claim';
        if not found then raise exception 'Заявка не найдена'; end if;
        if claim.room = my_room then raise exception 'Свою заявку проверять нельзя'; end if;
        if my_room <> checker and claim.room <> checker then
            raise exception 'Заявки проверяет комната %', checker;
        end if;
        new.target_room := claim.room; new.action := null; new.item := null; new.week := null;

    elsif new.kind = 'mess' then
        if new.target_room is null or new.target_room not in (70, 71, 72, 73, 74) or new.target_room = my_room then
            raise exception 'Пожаловаться можно только на чужую комнату';
        end if;
        if exists (select 1 from dorm_events where kind = 'mess' and room = my_room and target_room = new.target_room
                   and created_at > now() - interval '12 hours') then
            raise exception 'На эту комнату вы уже жаловались за последние 12 часов';
        end if;
        new.action := null; new.ref := null; new.item := null; new.week := null;

    elsif new.kind = 'purchase' then
        if new.week is null or new.week <> dorm_week() - 1 then raise exception 'Покупка отмечается за прошлую неделю'; end if;
        if new.item is distinct from (select count(*)::int from dorm_events where kind = 'purchase') then
            raise exception 'Эту вещь уже купили, обнови страницу';
        end if;
        new.action := null; new.ref := null; new.target_room := null;
    end if;
    return new;
end $$;

drop trigger if exists dorm_events_check on public.dorm_events;
create trigger dorm_events_check before insert on public.dorm_events
    for each row execute function public.dorm_events_check();

-- Живое обновление: сайт сразу видит, что нажали соседи.
do $$
begin
    alter publication supabase_realtime add table public.dorm_events;
exception when duplicate_object then null;
end $$;
do $$
begin
    alter publication supabase_realtime add table public.dorm_members;
exception when duplicate_object then null;
end $$;
