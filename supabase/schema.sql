-- Run once in the Supabase SQL editor, then run seed.sql.
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  email text not null,
  name text not null default '',
  avatar text not null default 'robot' check (avatar in ('robot','rocket','satellite','gear','brain','battery','microscope','bulb','technologist')),
  pronouns text check (pronouns in ('he/him','she/her')),
  role text not null default 'member' check (role in ('member','admin')),
  status text not null default 'pending' check (status in ('pending','approved','rejected','suspended')),
  member_id text unique,
  department text not null default '',
  study_year text not null default '',
  interests text[] not null default '{}',
  motivation text not null default '',
  submitted_at timestamptz,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists public.member_id_counters (
  department_code text primary key check (department_code in ('EC','ME','CS','EE','OT')),
  last_number bigint not null check (last_number > 0)
);
alter table public.member_id_counters enable row level security;
revoke all on public.member_id_counters from public,anon,authenticated;

create or replace function public.department_code(department_name text)
returns text language sql immutable set search_path = '' as $$
  select case regexp_replace(lower(coalesce(department_name,'')), '[^a-z0-9]', '', 'g')
    when 'ec' then 'EC' when 'ece' then 'EC' when 'electronics' then 'EC'
    when 'electronicsandcommunication' then 'EC' when 'electronicsandcommunicationengineering' then 'EC'
    when 'electronicandcommunicationengineering' then 'EC' when 'electronicscommunicationengineering' then 'EC'
    when 'me' then 'ME' when 'mechanical' then 'ME' when 'mechanicalengineering' then 'ME'
    when 'cs' then 'CS' when 'cse' then 'CS' when 'computerscience' then 'CS'
    when 'computerscienceengineering' then 'CS' when 'computerscienceandengineering' then 'CS'
    when 'ee' then 'EE' when 'eee' then 'EE' when 'electrical' then 'EE'
    when 'electricalengineering' then 'EE' when 'electricalandelectronicsengineering' then 'EE'
    else 'OT'
  end;
$$;

create or replace function public.allocate_member_id(department_name text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  code text := public.department_code(department_name);
  next_number bigint;
  candidate text;
begin
  loop
    -- Atomic increment serializes approvals within a department.
    insert into public.member_id_counters(department_code,last_number) values(code,1)
      on conflict(department_code) do update
      set last_number=public.member_id_counters.last_number+1
      returning last_number into next_number;
    candidate := 'SAC-' || code || '-' || lpad(next_number::text,greatest(3,length(next_number::text)),'0');
    if not exists(select 1 from public.profiles where member_id=candidate) then return candidate; end if;
  end loop;
end;
$$;
revoke execute on function public.allocate_member_id(text) from public,anon,authenticated;

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

create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create function public.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin' and status = 'approved');
$$;
create function public.is_approved() returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles where id = auth.uid() and status = 'approved');
$$;
alter table public.profiles enable row level security;
create policy profile_read on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());
-- Deliberately no client INSERT/UPDATE policies: privileged fields are RPC-only.

create or replace function public.review_member(target uuid, decision text)
returns void language plpgsql security definer set search_path = '' as $$
declare applicant public.profiles%rowtype;
begin
  if not public.is_admin() then raise exception 'Administrator access required'; end if;
  if decision is null or decision not in ('approved','rejected','suspended') then raise exception 'Invalid decision'; end if;
  if target = auth.uid() then raise exception 'You cannot review your own account'; end if;
  select * into applicant from public.profiles
    where id=target and role='member' and submitted_at is not null for update;
  if not found then raise exception 'Application not found'; end if;
  update public.profiles set status=decision, reviewed_at=now(),
    member_id=case when decision='approved'
      then coalesce(applicant.member_id,public.allocate_member_id(applicant.department))
      else applicant.member_id end
    where id=target;
end;
$$;
revoke execute on function public.review_member(uuid,text) from public,anon;
grant execute on function public.review_member(uuid,text) to authenticated;

create table public.content (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('event','project')),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (length(trim(title)) between 1 and 200),
  summary text not null default '',
  image text not null default '',
  image_alt text not null default '',
  tags text[] not null default '{}',
  data jsonb not null default '{}',
  published boolean not null default false,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now(),
  check (kind <> 'event' or (data->>'startDate' is not null and data->>'endDate' is not null and data->>'endDate' >= data->>'startDate'))
);
create table public.content_details (
  content_id uuid primary key references public.content on delete cascade,
  body text not null default ''
);
create table public.site_content (
  id text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
create table public.registrations (
  user_id uuid not null references public.profiles on delete cascade,
  event_id uuid not null references public.content on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id,event_id)
);
alter table public.content enable row level security;
alter table public.content_details enable row level security;
alter table public.site_content enable row level security;
alter table public.registrations enable row level security;
create policy content_read on public.content for select using (published or public.is_admin());
create policy content_manage on public.content for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy details_read on public.content_details for select to authenticated using (public.is_admin() or (public.is_approved() and exists(select 1 from public.content where id=content_id and published)));
create policy details_manage on public.content_details for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy site_read on public.site_content for select using (true);
create policy site_manage on public.site_content for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy registrations_read on public.registrations for select to authenticated using (user_id=auth.uid() or public.is_admin());
create policy registrations_create on public.registrations for insert to authenticated with check (
  user_id=auth.uid() and public.is_approved() and exists (
    select 1 from public.content where id=event_id and kind='event' and published
    and data->>'registrationOpen'='true' and (data->>'endDate')::date >= current_date
  )
);
create policy registrations_cancel on public.registrations for delete to authenticated using (user_id=auth.uid() or public.is_admin());

-- A content item and its private details are saved in a single transaction.
create function public.save_content(item jsonb, private_body text) returns uuid language plpgsql security definer set search_path = '' as $$
declare content_key uuid := coalesce((item->>'id')::uuid,gen_random_uuid());
begin
  if not public.is_admin() then raise exception 'Administrator access required'; end if;
  if item->>'kind'='event' then
    if (item->'data'->>'startDate')::date > (item->'data'->>'endDate')::date then raise exception 'End date must follow start date'; end if;
  end if;
  insert into public.content (id,kind,slug,title,summary,image,image_alt,tags,data,published,sort_order)
    values(content_key,item->>'kind',item->>'slug',item->>'title',coalesce(item->>'summary',''),coalesce(item->>'image',''),coalesce(item->>'image_alt',''),
      array(select jsonb_array_elements_text(item->'tags')),item->'data',(item->>'published')::boolean,(item->>'sort_order')::integer)
    on conflict(id) do update set slug=excluded.slug,title=excluded.title,summary=excluded.summary,image=excluded.image,image_alt=excluded.image_alt,
      tags=excluded.tags,data=excluded.data,published=excluded.published,sort_order=excluded.sort_order,updated_at=now();
  insert into public.content_details(content_id,body) values(content_key,private_body) on conflict(content_id) do update set body=excluded.body;
  return content_key;
end; $$;

revoke all on public.profiles from anon,authenticated;
grant select on public.profiles to authenticated;
grant select on public.content,public.site_content to anon,authenticated;
grant select,insert,update,delete on public.content,public.content_details,public.site_content,public.registrations to authenticated;
revoke execute on function public.handle_new_user(),public.review_member(uuid,text),public.save_profile(text,text),public.submit_application(text,text,text,text,text[],text,text),public.save_content(jsonb,text) from public,anon;
grant execute on function public.review_member(uuid,text),public.save_profile(text,text),public.submit_application(text,text,text,text,text[],text,text),public.save_content(jsonb,text) to authenticated;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('content-images','content-images',true,5242880,array['image/jpeg','image/png','image/webp','image/gif']) on conflict(id) do nothing;
create policy image_read on storage.objects for select using (bucket_id='content-images');
create policy image_create on storage.objects for insert to authenticated with check (bucket_id='content-images' and public.is_admin());
create policy image_delete on storage.objects for delete to authenticated using (bucket_id='content-images' and public.is_admin());

-- Project detail access (also available as an existing-database migration).
lock table public.content in share row exclusive mode;
alter table public.content_details add column if not exists data jsonb not null default '{}'::jsonb;

-- Use an allowlist so future project detail fields are private by default.
-- The AFTER trigger can create the protected row after its parent exists. Its
-- nested update contains only preview keys, so it does not recurse further.
create or replace function public.protect_project_details() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  preview jsonb;
  private_data jsonb;
begin
  if new.kind <> 'project' then return new; end if;
  select coalesce(jsonb_object_agg(key,value),'{}'::jsonb) into preview
  from jsonb_each(new.data)
  where key in ('category','subtitle','status','homeProject','heroFeatured','imageCaption');
  private_data := new.data - array['category','subtitle','status','homeProject','heroFeatured','imageCaption'];
  if private_data <> '{}'::jsonb then
    insert into public.content_details(content_id,data) values(new.id,private_data)
    on conflict(content_id) do update
      set data=public.content_details.data || excluded.data;
    update public.content set data=preview where id=new.id;
  end if;
  return new;
end;
$$;
revoke execute on function public.protect_project_details() from public,anon,authenticated;
drop trigger if exists project_details_private on public.content;
create trigger project_details_private after insert or update of data,kind on public.content
for each row execute function public.protect_project_details();

-- This also preserves notes, empty fields, unpublished projects, and custom data.
update public.content set data=data where kind='project';
