-- Existing databases: run after the department ID migration. Safe to rerun.
begin;
lock table public.profiles in share row exclusive mode;
alter table public.profiles add column if not exists pronouns text;
alter table public.profiles drop constraint if exists profiles_avatar_check;
alter table public.profiles drop constraint if exists profiles_pronouns_check;
-- Preserve the previous choice separately before replacing the old avatars.
update public.profiles set pronouns=case avatar when 'girl' then 'she/her' when 'boy' then 'he/him' end
where pronouns is null and avatar in ('boy','girl');
update public.profiles set avatar=case when role='admin' then 'technologist' else 'robot' end
where avatar in ('boy','girl') or (role='admin' and avatar<>'technologist');
alter table public.profiles alter column avatar set default 'robot';
alter table public.profiles add constraint profiles_avatar_check check (avatar in ('robot','rocket','satellite','gear','brain','battery','microscope','bulb','technologist'));
alter table public.profiles add constraint profiles_pronouns_check check (pronouns in ('he/him','she/her'));

create or replace function public.lock_profile_choices() returns trigger
language plpgsql set search_path = '' as $$
begin
  if TG_OP='UPDATE' then
    if old.pronouns is not null and new.pronouns is distinct from old.pronouns then
      raise exception 'Pronouns cannot be changed after selection';
    end if;
  end if;
  if new.role='admin' then new.avatar := 'technologist';
  elsif new.avatar='technologist' then raise exception 'The technologist emoji is reserved for administrators';
  end if;
  return new;
end; $$;
revoke execute on function public.lock_profile_choices() from public,anon,authenticated;
drop trigger if exists profile_choices_locked on public.profiles;
create trigger profile_choices_locked before insert or update on public.profiles
for each row execute function public.lock_profile_choices();

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
declare
  chosen_pronouns text := coalesce(new.raw_user_meta_data->>'pronouns',case new.raw_user_meta_data->>'avatar' when 'girl' then 'she/her' when 'boy' then 'he/him' end);
  chosen_emoji text := new.raw_user_meta_data->>'avatar';
begin
  if chosen_pronouns is not null and chosen_pronouns not in ('he/him','she/her') then raise exception 'Choose valid pronouns'; end if;
  if length(trim(coalesce(new.raw_user_meta_data->>'motivation',''))) > 0 and chosen_pronouns is null then raise exception 'Choose your pronouns'; end if;
  if chosen_emoji is null or chosen_emoji not in ('robot','rocket','satellite','gear','brain','battery','microscope','bulb') then chosen_emoji := 'robot'; end if;
  insert into public.profiles (id,email,name,avatar,pronouns,department,study_year,interests,motivation,submitted_at)
  values (new.id, coalesce(new.email,''), left(coalesce(new.raw_user_meta_data->>'name',''),120),chosen_emoji,chosen_pronouns,
    left(coalesce(new.raw_user_meta_data->>'department',''),100), left(coalesce(new.raw_user_meta_data->>'study_year',''),20),
    case when jsonb_typeof(new.raw_user_meta_data->'interests')='array' then array(select jsonb_array_elements_text(new.raw_user_meta_data->'interests')) else '{}' end,
    left(coalesce(new.raw_user_meta_data->>'motivation',''),4000),
    case when length(trim(coalesce(new.raw_user_meta_data->>'motivation',''))) > 0 then now() end);
  return new;
end; $$;
revoke execute on function public.handle_new_user() from public,anon,authenticated;

create or replace function public.save_profile(display_name text, emoji text) returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if length(trim(coalesce(display_name,''))) not between 1 and 120 or coalesce(emoji,'') not in ('robot','rocket','satellite','gear','brain','battery','microscope','bulb','technologist') then raise exception 'Invalid profile'; end if;
  update public.profiles set name=trim(display_name),avatar=case when role='admin' then 'technologist' else emoji end where id=auth.uid();
end; $$;

-- Remove the old overload so PostgREST resolves the expanded RPC unambiguously.
drop function if exists public.submit_application(text,text,text,text,text[],text);
create or replace function public.submit_application(display_name text, emoji text, department_name text, year_value text, interest_values text[], reason text, member_pronouns text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare applicant public.profiles%rowtype;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select * into applicant from public.profiles where id=auth.uid() for update;
  if not found or applicant.status<>'pending' or applicant.submitted_at is not null then raise exception 'An application has already been submitted'; end if;
  if applicant.pronouns is not null and member_pronouns is not null and applicant.pronouns<>member_pronouns then raise exception 'Pronouns cannot be changed after selection'; end if;
  if length(trim(coalesce(display_name,''))) not between 1 and 120
     or coalesce(emoji,'') not in ('robot','rocket','satellite','gear','brain','battery','microscope','bulb')
     or coalesce(applicant.pronouns,member_pronouns,'') not in ('he/him','she/her')
     or length(trim(coalesce(reason,''))) not between 1 and 4000
     or length(trim(coalesce(department_name,''))) not between 1 and 100
     or length(trim(coalesce(year_value,''))) not between 1 and 20 then raise exception 'Complete all application fields'; end if;
  update public.profiles set name=trim(display_name),avatar=emoji,pronouns=coalesce(applicant.pronouns,member_pronouns),department=department_name,study_year=year_value,
    interests=coalesce(interest_values,'{}'),motivation=reason,submitted_at=now() where id=auth.uid();
end; $$;
revoke execute on function public.save_profile(text,text),public.submit_application(text,text,text,text,text[],text,text) from public,anon;
grant execute on function public.save_profile(text,text),public.submit_application(text,text,text,text,text[],text,text) to authenticated;

notify pgrst, 'reload schema';
commit;
