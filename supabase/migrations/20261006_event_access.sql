-- Existing events stay members-only unless an admin explicitly opens them.
begin;
drop policy if exists details_read on public.content_details;
create policy details_read on public.content_details for select to anon,authenticated
using (
  public.is_admin() or exists (
    select 1 from public.content
    where id=content_id and published and (
      public.is_approved() or (kind='event' and data->>'access'='public')
    )
  )
);
grant select on public.content_details to anon;
commit;
