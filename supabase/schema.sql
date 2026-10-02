create table public.profiles (
    id uuid primary key references auth.users (id) on delete cascade,
    display_name text,
    role text not null default 'user' check (role in ('user', 'admin')),
    created_at timestamptz not null default now()
);

create table public.tasks (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
    text text not null check (char_length(trim(text)) between 1 and 500),
    completed boolean not null default false,
    created_at timestamptz not null default now()
);

create table public.snippets (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
    title text not null check (char_length(trim(title)) between 1 and 120),
    code text not null check (char_length(trim(code)) between 1 and 20000),
    created_at timestamptz not null default now()
);

create table public.messages (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
    sender text not null check (sender in ('user', 'guide')),
    text text not null check (char_length(trim(text)) between 1 and 4000),
    created_at timestamptz not null default now()
);

create index tasks_user_created_at_idx on public.tasks (user_id, created_at);
create index snippets_user_created_at_idx on public.snippets (user_id, created_at);
create index messages_user_created_at_idx on public.messages (user_id, created_at);

alter table public.profiles enable row level security;
alter table public.tasks enable row level security;
alter table public.snippets enable row level security;
alter table public.messages enable row level security;

create policy "Users can read their own profile"
    on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "Users can manage their own tasks"
    on public.tasks for all to authenticated using ((select auth.uid()) = user_id)
    with check ((select auth.uid()) = user_id);
create policy "Users can manage their own snippets"
    on public.snippets for all to authenticated using ((select auth.uid()) = user_id)
    with check ((select auth.uid()) = user_id);
create policy "Users can manage their own messages"
    on public.messages for all to authenticated using ((select auth.uid()) = user_id)
    with check ((select auth.uid()) = user_id);

grant select on public.profiles to authenticated;
revoke insert, update, delete on public.profiles from authenticated;
grant select, insert, update, delete on public.tasks, public.snippets, public.messages to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    insert into public.profiles (id, display_name)
    values (new.id, new.raw_user_meta_data ->> 'display_name');
    return new;
end;
$$;

create trigger on_auth_user_created
    after insert on auth.users
    for each row execute procedure public.handle_new_user();