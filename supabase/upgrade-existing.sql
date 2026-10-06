-- Existing SAC databases only: paste this entire file into Supabase SQL Editor.
-- All changes commit together. Does not insert projects, reset passwords or change approval status.
begin;

-- SOURCE: 20261004_department_member_ids.sql
-- Existing projects: run this entire file in the Supabase SQL editor.
-- Converts old membership numbers and keeps already-issued department IDs.
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

-- SOURCE: 20261006_profile_choices.sql
-- Existing databases: run after the department ID migration. Safe to rerun.
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

-- SOURCE: 20261006_project_briefs.sql
-- Persist new public briefs for existing concept projects.
-- Fill missing JSON keys only; keep explicit edits, empty fields and custom images.
-- Never copy member-only content_details into public content. Safe to rerun.

update public.content set
  data='{"overview":"Atlas explores how a small wheeled robot could sense an unfamiliar indoor space and choose its next move. The concept starts with reliable movement and obstacle detection before attempting more ambitious navigation.","challenge":"A useful rover needs to react to obstacles, handle imperfect sensor readings, and stop predictably when a command or connection is lost. The first goal is controlled exploration in a small, supervised test area.","approach":"Build and test the drive base first. Add distance sensing and a stop-on-obstacle loop, then log what the robot sees. Use those observations to compare simple navigation strategies before considering mapping.","features":"Obstacle-aware movement\nManual control with a stop command\nSensor readings and movement logs\nA modular base for later navigation experiments","techStack":"Microcontroller and motor driver\nDistance sensors or compact lidar\nWheel encoders\nEmbedded C/C++ or MicroPython\nPython for log analysis","milestones":"Define the test area and movement limits\nValidate motor control and stopping\nIntegrate sensing and obstacle detection\nCompare navigation runs and document failures","nextSteps":"Choose a drive platform, document the wiring and power requirements, and run a short supervised movement test. Record limitations before adding autonomous behaviour.","imageCaption":"Illustrative concept render","githubUrl":""}'::jsonb || coalesce(data,'{}'::jsonb),
  image=case when image in ('/showcase-assets/rover.jpg','/showcase-assets/vision.jpg','showcase-assets/rover.jpg','showcase-assets/vision.jpg') then '/showcase-assets/project-atlas.jpg' else image end,
  image_alt=case when image in ('/showcase-assets/rover.jpg','/showcase-assets/vision.jpg','showcase-assets/rover.jpg','showcase-assets/vision.jpg') then 'Concept render of an assembled white autonomous rover with four wheels and a lidar sensor.' else image_alt end
where kind='project' and slug='rover';

update public.content set
  data='{"overview":"Iris is a computer-vision concept for turning a camera feed into useful observations. A first version could recognise a small set of objects on a workbench and explain how confidently it identifies them.","challenge":"Lighting, backgrounds, camera position, and similar-looking objects can all change a model’s predictions. A meaningful demonstration should show both successful detections and cases where the system is uncertain.","approach":"Start with a fixed camera and a small, documented set of sample objects. Build a repeatable capture pipeline, compare a simple baseline with a trained model, and inspect errors using images excluded from training.","features":"Live camera preview\nObject labels and confidence display\nA small, documented evaluation set\nClear handling of uncertain predictions","techStack":"USB or board camera\nPython and OpenCV\nA lightweight vision model\nImage annotation tools\nLocal inference interface","milestones":"Choose the objects and capture conditions\nCollect and label representative images\nBuild a baseline and inspect mistakes\nEvaluate on held-out examples and document limits","nextSteps":"Agree on one recognition task and collect an initial set of example images. Define what counts as a useful prediction before choosing a model.","imageCaption":"Illustrative concept render","githubUrl":""}'::jsonb || coalesce(data,'{}'::jsonb),
  image=case when image in ('/showcase-assets/rover.jpg','/showcase-assets/vision.jpg','showcase-assets/rover.jpg','showcase-assets/vision.jpg') then '/showcase-assets/project-iris.jpg' else image end,
  image_alt=case when image in ('/showcase-assets/rover.jpg','/showcase-assets/vision.jpg','showcase-assets/rover.jpg','showcase-assets/vision.jpg') then 'Concept render of a compact vision camera observing geometric sample objects.' else image_alt end
where kind='project' and slug='vision';

update public.content set
  data='{"overview":"Pulse imagines a small network of environmental sensors that makes changes in a room easier to understand. Individual readings become a shared view of temperature, humidity, or light over time.","challenge":"A dashboard should distinguish fresh readings from stale or missing data. Sensors also need calibration checks, consistent timestamps, and a clear explanation of what each measurement represents.","approach":"Connect one sensor node and display its readings locally. Add a simple message format, then connect multiple nodes to a dashboard. Test disconnections and missing readings before expanding the network.","features":"Multiple named sensor nodes\nLive readings and historical trends\nLast-seen indicators for each device\nConfigurable thresholds for environmental changes","techStack":"Wi-Fi microcontroller\nEnvironmental sensor modules\nMQTT or HTTP messaging\nTime-series storage\nWeb dashboard","milestones":"Read and sanity-check one sensor\nSend timestamped readings to a receiver\nDisplay multiple nodes on a dashboard\nTest reconnects, missing data, and threshold rules","nextSteps":"Pick the measurements that matter for one room, assemble a single node, and agree on a common data format before building the dashboard.","imageCaption":"Illustrative concept render","githubUrl":""}'::jsonb || coalesce(data,'{}'::jsonb),
  image=case when image in ('/showcase-assets/rover.jpg','/showcase-assets/vision.jpg','showcase-assets/rover.jpg','showcase-assets/vision.jpg') then '/showcase-assets/project-pulse.jpg' else image end,
  image_alt=case when image in ('/showcase-assets/rover.jpg','/showcase-assets/vision.jpg','showcase-assets/rover.jpg','showcase-assets/vision.jpg') then 'Concept render of three compact wireless environmental sensor nodes.' else image_alt end
where kind='project' and slug='signal';

update public.content set
  data='{"overview":"Dexter is a motion-control concept centred on a small tabletop robotic arm. Its first experiment is a repeatable pick-and-place movement using a lightweight object and a clearly defined workspace.","challenge":"Joint limits, mechanical play, object position, and movement speed affect repeatability. The build should start with one controlled joint and a simple stop mechanism before coordinating an entire arm.","approach":"Model the arm geometry, explore joint motion in simulation, and verify each actuator individually. Add a gripper and slowly combine joints into a repeatable movement sequence within tested limits.","features":"Individual joint control\nDefined movement limits\nA lightweight pick-and-place routine\nRecorded positions for repeatable sequences","techStack":"Servo motors and controller\nLightweight links and gripper\nCAD and motion simulation\nEmbedded control firmware\nBasic kinematics","milestones":"Define reach, joint limits, and a small test object\nSimulate the intended movement\nTest one joint and a stop command\nCombine movements and measure repeatability","nextSteps":"Sketch a simple arm, select a lightweight test object, and validate a single joint. Keep the first movement slow and supervised while documenting the mechanism.","imageCaption":"Illustrative concept render","githubUrl":""}'::jsonb || coalesce(data,'{}'::jsonb),
  image=case when image in ('/showcase-assets/rover.jpg','/showcase-assets/vision.jpg','showcase-assets/rover.jpg','showcase-assets/vision.jpg') then '/showcase-assets/project-dexter.jpg' else image end,
  image_alt=case when image in ('/showcase-assets/rover.jpg','/showcase-assets/vision.jpg','showcase-assets/rover.jpg','showcase-assets/vision.jpg') then 'Concept render of an assembled desktop robotic arm reaching toward a green cube.' else image_alt end
where kind='project' and slug='arm';


commit;

select member_id, department, status from public.profiles order by created_at;
