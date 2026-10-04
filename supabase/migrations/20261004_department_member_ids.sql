-- Existing projects: run this entire file in the Supabase SQL editor.
-- Converts old membership numbers and keeps already-issued department IDs.
begin;
lock table public.profiles in share row exclusive mode;

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

-- Start after any department numbers that have already been issued.
insert into public.member_id_counters(department_code,last_number)
select split_part(member_id,'-',2),max(split_part(member_id,'-',3)::bigint)
from public.profiles
where member_id ~ '^SAC-(EC|ME|CS|EE|OT)-[0-9]{3,}$'
group by split_part(member_id,'-',2)
having max(split_part(member_id,'-',3)::bigint)>0
on conflict(department_code) do update
set last_number=greatest(public.member_id_counters.last_number,excluded.last_number);

-- Keep user UUIDs, passwords, approval status, and registrations intact.
do $$
declare applicant record;
begin
  for applicant in
    select id,department from public.profiles
    where (member_id is not null and member_id !~ '^SAC-(EC|ME|CS|EE|OT)-[0-9]{3,}$')
       or (member_id is null and role='member' and status='approved')
    order by created_at,id
  loop
    update public.profiles set member_id=public.allocate_member_id(applicant.department) where id=applicant.id;
  end loop;
end;
$$;
commit;
