-- Keep project previews public and move all other project data behind existing RLS.
-- Run on the existing database before deploying the updated frontend. Safe to rerun.
begin;
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
commit;
