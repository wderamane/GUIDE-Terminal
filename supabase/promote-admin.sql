-- Run this in the Supabase SQL Editor after schema.sql has been applied.
-- Replace the email below with the email of the account you created.

alter table public.profiles
    add column if not exists role text not null default 'user';

alter table public.profiles
    drop constraint if exists profiles_role_check;

alter table public.profiles
    add constraint profiles_role_check check (role in ('user', 'admin'));

drop policy if exists "Users can update their own profile" on public.profiles;
revoke insert, update, delete on public.profiles from authenticated;
grant select on public.profiles to authenticated;

do $$
declare
    target_user_id uuid;
begin
    select id into target_user_id
    from auth.users
    where lower(email) = lower('deram.waren01@gmail.com');

    if target_user_id is null then
        raise exception 'No account found for that email. Create the account first and check the email value.';
    end if;

    update public.profiles
    set role = 'admin'
    where id = target_user_id;
end;
$$;