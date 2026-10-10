import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const db=new PGlite();
const admin='00000000-0000-4000-8000-000000000001', pending='00000000-0000-4000-8000-000000000002', member='00000000-0000-4000-8000-000000000003';
let eventId, draftId, projectId;
before(async()=>{
  // Supabase-owned schemas are stubbed; every application table, RPC and policy
  // below is the actual production SQL, executed by PostgreSQL.
  await db.exec(`create role anon; create role authenticated;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth,public,storage to anon,authenticated;
    grant execute on function auth.uid() to anon,authenticated;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
    alter table storage.objects enable row level security;
    grant select,insert,delete on storage.objects to anon,authenticated;`);
  await db.exec(readFileSync('supabase/schema.sql','utf8'));
  await db.exec(readFileSync('supabase/seed.sql','utf8'));
  for(const [id,email] of [[admin,'admin@test.local'],[pending,'pending@test.local'],[member,'member@test.local']]) await db.query(`insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,$2,now(),$3)`,[id,email,JSON.stringify({name:email,department:'CS',study_year:'2',motivation:'I like robots',role:'admin',status:'approved',avatar:'girl'})]);
  await db.query(`update public.profiles set role='admin',status='approved' where id=$1`,[admin]);
  await db.query(`update public.profiles set status='approved' where id=$1`,[member]);
  eventId=(await db.query(`update public.content set data=data||'{"startDate":"2099-01-01","endDate":"2099-01-02","registrationOpen":true}' where slug='genesis' returning id`)).rows[0].id;
  draftId=(await db.query(`insert into public.content(kind,slug,title,published) values('project','secret-draft','Secret draft',false) returning id`)).rows[0].id;
  await db.query(`insert into public.content_details(content_id,body) values($1,'Private draft text')`,[draftId]);
  projectId=(await db.query(`select id from public.content where slug='rover'`)).rows[0].id;
});
after(()=>db.close());
async function as(role,id,fn){
  await db.exec(`set role ${role}`);
  await db.query(`select set_config('request.jwt.claim.sub',$1,false)`,[id||'']);
  try{return await fn();}finally{await db.exec('reset role');await db.query(`select set_config('request.jwt.claim.sub','',false)`);}
}
test('signup metadata cannot grant approval or administrator privileges',async()=>{
  const p=(await db.query('select * from public.profiles where id=$1',[pending])).rows[0];
  assert.equal(p.role,'member');assert.equal(p.status,'pending');assert.equal(p.avatar,'robot');assert.equal(p.pronouns,'she/her');assert(p.submitted_at);assert.equal(p.member_id,null);
});
test('anonymous visitors get published previews only',async()=>as('anon',null,async()=>{
  assert.equal((await db.query('select * from public.content')).rows.length,7);
  assert.equal((await db.query('select * from public.content_details')).rows.length,0);
  await assert.rejects(db.query('select * from public.profiles'),/permission denied/);
  await assert.rejects(db.query("insert into public.site_content values('x','bad',now())"),/permission denied/);
}));
test('pending members cannot self-approve, edit content, register or read private details',async()=>as('authenticated',pending,async()=>{
  assert.equal((await db.query('select * from public.profiles')).rows.length,1);
  assert.equal((await db.query('select * from public.content_details')).rows.length,0);
  await assert.rejects(db.query("update public.profiles set status='approved' where id=$1",[pending]),/permission denied/);
  await assert.rejects(db.query("select public.review_member($1,'approved')",[pending]),/Administrator access required/);
  await assert.rejects(db.query("insert into public.content(kind,slug,title) values('project','bad','bad')"),/row-level security/);
  await assert.rejects(db.query('insert into public.registrations(user_id,event_id) values($1,$2)',[pending,eventId]),/row-level security/);
  await assert.rejects(db.query("select public.save_content('{}','bad')"),/Administrator access required/);
}));
test('approved members can read published details but not drafts or other profiles',async()=>as('authenticated',member,async()=>{
  assert.equal((await db.query('select * from public.content_details')).rows.length,7);
  assert.equal((await db.query('select * from public.content_details where content_id=$1',[draftId])).rows.length,0);
  assert.equal((await db.query('select * from public.profiles where id=$1',[admin])).rows.length,0);
  await assert.rejects(db.query("insert into storage.objects(bucket_id,name) values('content-images','unauthorized.png')"),/row-level security/);
}));
test('registrations enforce ownership, event type, availability and uniqueness',async()=>as('authenticated',member,async()=>{
  await db.query('insert into public.registrations(user_id,event_id) values($1,$2)',[member,eventId]);
  await assert.rejects(db.query('insert into public.registrations(user_id,event_id) values($1,$2)',[member,eventId]),/duplicate key/);
  await assert.rejects(db.query('insert into public.registrations(user_id,event_id) values($1,$2)',[pending,eventId]),/row-level security/);
  await assert.rejects(db.query('insert into public.registrations(user_id,event_id) values($1,$2)',[member,projectId]),/row-level security/);
  const closed=(await db.query("select id from public.content where slug='robowars'")).rows[0].id;
  await assert.rejects(db.query('insert into public.registrations(user_id,event_id) values($1,$2)',[member,closed]),/row-level security/);
}));
test('admins approve members and IDs remain stable across suspension and reapproval',async()=>{
  await as('authenticated',admin,async()=>{
    await db.query("select public.review_member($1,'approved')",[pending]);
    const first=(await db.query('select member_id from public.profiles where id=$1',[pending])).rows[0].member_id;assert.equal(first,'SAC-CS-001');
    await db.query("select public.review_member($1,'suspended')",[pending]);
    await db.query("select public.review_member($1,'approved')",[pending]);
    assert.equal((await db.query('select member_id from public.profiles where id=$1',[pending])).rows[0].member_id,first);
    await assert.rejects(db.query("select public.review_member($1,'approved')",[admin]),/own account/);
    await db.query("select public.review_member($1,'suspended')",[pending]);
  });
  await as('authenticated',pending,async()=>assert.equal((await db.query('select * from public.content_details')).rows.length,0));
});
test('admin save is atomic; published content and deletion respect foreign keys',async()=>as('authenticated',admin,async()=>{
  const item={kind:'project',slug:'test-project',title:'Test project',summary:'Public preview',image:'',image_alt:'',tags:['AI'],data:{category:'ai',overview:'Public build brief',githubUrl:'https://github.com/example/robot',features:'Sensing\nControl',milestones:'Plan\nBuild',heroFeatured:true},published:true,sort_order:10};
  const id=(await db.query('select public.save_content($1,$2) as id',[JSON.stringify(item),'Secret documentation'])).rows[0].id;
  assert.equal((await db.query('select body from public.content_details where content_id=$1',[id])).rows[0].body,'Secret documentation');
  assert.deepEqual((await db.query('select data from public.content where id=$1',[id])).rows[0].data,{category:'ai',heroFeatured:true});
  assert.equal((await db.query('select data from public.content_details where content_id=$1',[id])).rows[0].data.overview,item.data.overview);
  await assert.rejects(db.query('select public.save_content($1,$2)',[JSON.stringify({...item,slug:'rollback-test'}),null]),/not-null constraint/);
  assert.equal((await db.query("select * from public.content where slug='rollback-test'")).rows.length,0);
  await db.query('delete from public.content where id=$1',[id]);
  assert.equal((await db.query('select * from public.content_details where content_id=$1',[id])).rows.length,0);
  await db.query("insert into public.site_content(id,value) values('home-title','Updated heading')");
  await db.query("insert into storage.objects(bucket_id,name) values('content-images','admin.png')");
}));

 test('department migration repairs legacy IDs, preserves issued IDs and is repeatable',async()=>{
  await db.query("update public.profiles set member_id='sac1001',department='ece' where id=$1",[member]);
  const migration=readFileSync('supabase/migrations/20261004_department_member_ids.sql','utf8');
  await db.exec(migration);
  const ids=(await db.query('select id,member_id from public.profiles order by id')).rows;
  assert.equal(ids.find(p=>p.id===member).member_id,'SAC-EC-001');
  assert.equal(ids.find(p=>p.id===pending).member_id,'SAC-CS-001');
  await db.exec(migration);
  assert.deepEqual((await db.query('select id,member_id from public.profiles order by id')).rows,ids);
  assert.equal((await db.query("select public.allocate_member_id('Electronics and Communication Engineering') as id")).rows[0].id,'SAC-EC-002');
  assert.equal((await db.query("select public.allocate_member_id('Mechanical') as id")).rows[0].id,'SAC-ME-001');
  await db.query("update public.member_id_counters set last_number=999 where department_code='EC'");
  assert.equal((await db.query("select public.allocate_member_id('ece') as id")).rows[0].id,'SAC-EC-1000');
 });


test('members can change all eight emojis while pronouns stay fixed',async()=>{
  await as('authenticated',member,async()=>{
    for(const emoji of ['robot','rocket','satellite','gear','brain','battery','microscope','bulb']){
      await db.query('select public.save_profile($1,$2)',['Maker',emoji]);
      const p=(await db.query('select avatar,pronouns from public.profiles where id=$1',[member])).rows[0];
      assert.equal(p.avatar,emoji);assert.equal(p.pronouns,'she/her');
    }
    await assert.rejects(db.query("select public.save_profile('Maker','technologist')"),/reserved for administrators/);
    await assert.rejects(db.query("select public.save_profile('Maker','invalid')"),/Invalid profile/);
    await assert.rejects(db.query("select public.save_profile('Maker',null)"),/Invalid profile/);
    await assert.rejects(db.query("update public.profiles set pronouns='he/him' where id=$1",[member]),/permission denied/);
  });
  await assert.rejects(db.query("update public.profiles set pronouns='he/him' where id=$1",[member]),/cannot be changed/);
  await assert.rejects(db.query("update public.profiles set pronouns=null where id=$1",[member]),/cannot be changed/);
  await as('authenticated',admin,()=>db.query("select public.save_profile('Admin','rocket')"));
  assert.equal((await db.query('select avatar from public.profiles where id=$1',[admin])).rows[0].avatar,'technologist');
});

test('OAuth applications choose pronouns once and cannot resubmit or reserve the admin emoji',async()=>{
  const id='00000000-0000-4000-8000-000000000020';
  await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,'oauth@example.test',now())",[id]);
  await as('authenticated',id,async()=>{
    await assert.rejects(db.query("select public.submit_application('New Maker','robot','ece','2','{}','Build robots')"),/Complete all application fields/);
    await db.query("select public.submit_application('New Maker','satellite','ece','2','{}','Build robots','he/him')");
    const p=(await db.query('select * from public.profiles where id=$1',[id])).rows[0];
    assert.equal(p.pronouns,'he/him');assert.equal(p.avatar,'satellite');assert(p.submitted_at);
    await assert.rejects(db.query("select public.submit_application('New Maker','robot','ece','2','{}','Build robots','she/her')"),/already been submitted/);
  });
});

test('profile migration preserves legacy selections and is repeatable',async()=>{
  await db.exec('drop trigger profile_choices_locked on public.profiles; alter table public.profiles drop constraint profiles_avatar_check');
  await db.query("update public.profiles set avatar='girl',pronouns=null where id=$1",[member]);
  await db.query("update public.profiles set avatar='boy',pronouns=null where id=$1",[admin]);
  const sql=readFileSync('supabase/migrations/20261006_profile_choices.sql','utf8');
  await db.exec(sql);
  let rows=(await db.query('select id,avatar,pronouns from public.profiles order by id')).rows;
  assert.equal(rows.find(p=>p.id===member).pronouns,'she/her');
  assert.equal(rows.find(p=>p.id===member).avatar,'robot');
  assert.equal(rows.find(p=>p.id===admin).pronouns,'he/him');
  assert.equal(rows.find(p=>p.id===admin).avatar,'technologist');
  await db.exec(sql);
  assert.deepEqual((await db.query('select id,avatar,pronouns from public.profiles order by id')).rows,rows);
});

test('project migration persists briefs, preserves edits and private notes, and never resurrects projects',async()=>{
  await db.query(`update public.content set data='{"overview":"My custom brief","features":"","githubUrl":"https://github.com/SAclub/custom"}',image='/my-custom.jpg' where slug='rover'`);
  await db.query(`update public.content set data='{}',image='/showcase-assets/vision.jpg' where slug='vision'`);
  const privateBefore=(await db.query('select content_id,body from public.content_details order by content_id')).rows;
  const sql=readFileSync('supabase/migrations/20261006_project_briefs.sql','utf8');
  await db.exec(sql);
  const rows=(await db.query("select * from public.content where kind='project' order by id")).rows;
  const rover=rows.find(p=>p.slug==='rover'),vision=rows.find(p=>p.slug==='vision');
  assert.equal(rover.data.overview,undefined);assert.equal(vision.data.overview,undefined);
  rover.data=(await db.query('select data from public.content_details where content_id=$1',[rover.id])).rows[0].data;
  vision.data=(await db.query('select data from public.content_details where content_id=$1',[vision.id])).rows[0].data;
  assert.equal(rover.image,'/my-custom.jpg');assert.equal(rover.data.overview,'My custom brief');assert.equal(rover.data.features,'');assert.equal(rover.data.githubUrl,'https://github.com/SAclub/custom');
  assert.match(vision.data.overview,/Iris/);assert.match(vision.image,/project-iris/);
  assert.deepEqual((await db.query('select content_id,body from public.content_details order by content_id')).rows,privateBefore);
  const publicBefore=(await db.query("select * from public.content where kind='project' order by id")).rows;
  const detailsBefore=(await db.query('select * from public.content_details order by content_id')).rows;
  await db.exec(sql);
  assert.deepEqual((await db.query("select * from public.content where kind='project' order by id")).rows,publicBefore);
  assert.deepEqual((await db.query('select * from public.content_details order by content_id')).rows,detailsBefore);
  await db.query("delete from public.content where slug='arm'");
  await db.exec(sql);
  assert.equal((await db.query("select * from public.content where slug='arm'")).rows.length,0);
});


test('the combined existing-database upgrade is repeatable',async()=>{
  const sql=readFileSync('supabase/upgrade-existing.sql','utf8');
  await db.exec(sql);
  const profiles=(await db.query('select * from public.profiles order by id')).rows;
  const content=(await db.query('select * from public.content order by id')).rows;
  await db.exec(sql);
  assert.deepEqual((await db.query('select * from public.profiles order by id')).rows,profiles);
  assert.deepEqual((await db.query('select * from public.content order by id')).rows,content);
});


test('project access migration removes existing public details and enforces membership for direct API reads',async()=>{
  await db.exec('drop trigger project_details_private on public.content');
  await db.query(`update public.content set data=data || '{"overview":"Migrated private brief","features":"","githubUrl":"https://github.com/SAclub/private","futureField":"Private by default"}' where id=$1`,[projectId]);
  const notes=(await db.query('select body from public.content_details where content_id=$1',[projectId])).rows[0].body;
  const sql=readFileSync('supabase/migrations/20261006_project_member_access.sql','utf8');
  await db.exec(sql);
  const details=(await db.query('select * from public.content_details where content_id=$1',[projectId])).rows[0];
  assert.equal(details.body,notes);
  assert.equal(details.data.overview,'Migrated private brief');
  assert.equal(details.data.features,'');
  assert.equal(details.data.futureField,'Private by default');
  await db.exec(sql);
  assert.deepEqual((await db.query('select * from public.content_details where content_id=$1',[projectId])).rows[0],details);
  await as('anon',null,async()=>{
    const preview=(await db.query('select * from public.content where id=$1',[projectId])).rows[0];
    assert(preview.title);assert(preview.image);
    for(const key of ['overview','features','githubUrl','futureField'])assert.equal(preview.data[key],undefined);
    assert.equal((await db.query('select data from public.content_details where content_id=$1',[projectId])).rows.length,0);
  });
  for(const status of ['pending','rejected','suspended']){
    await db.query('update public.profiles set status=$1 where id=$2',[status,pending]);
    await as('authenticated',pending,async()=>{
      assert.equal((await db.query('select data from public.content_details where content_id=$1',[projectId])).rows.length,0);
      assert.equal((await db.query('select data from public.content where id=$1',[projectId])).rows[0].data.overview,undefined);
    });
  }
  await as('authenticated',member,async()=>assert.equal((await db.query('select data from public.content_details where content_id=$1',[projectId])).rows[0].data.overview,'Migrated private brief'));
  await as('authenticated',admin,async()=>{
    await db.query(`update public.content set data=data || '{"overview":"","newDetail":"Only members"}' where id=$1`,[projectId]);
    assert.equal((await db.query('select data from public.content_details where content_id=$1',[projectId])).rows[0].data.overview,'');
    assert.equal((await db.query('select data from public.content where id=$1',[projectId])).rows[0].data.newDetail,undefined);
  });
});

test('event access can open and close details without exposing projects or drafts',async()=>{
  const migration=readFileSync('supabase/migrations/20261006_event_access.sql','utf8');
  await db.exec(migration);await db.exec(migration);
  const existing=(await db.query('select * from public.content where id=$1',[eventId])).rows[0];
  async function saveAccess(access,published=true){
    await as('authenticated',admin,()=>db.query('select public.save_content($1,$2)',[JSON.stringify({...existing,published,data:{...existing.data,access}}),'Event schedule for visitors']));
  }
  await saveAccess('public');
  for(const [role,id] of [['anon',null],['authenticated',pending],['authenticated',member]]){
    await as(role,id,async()=>{
      assert.equal((await db.query('select body from public.content_details where content_id=$1',[eventId])).rows[0].body,'Event schedule for visitors');
      assert.equal((await db.query('select * from public.content_details where content_id=$1',[draftId])).rows.length,0);
      if(id!==member)assert.equal((await db.query('select * from public.content_details where content_id=$1',[projectId])).rows.length,0);
    });
  }
  await as('anon',null,()=>assert.rejects(db.query("update public.content set data=data || '{\"access\":\"public\"}' where id=$1",[eventId]),/permission denied/));
  await as('authenticated',pending,async()=>{
    await assert.rejects(db.query('insert into public.registrations(user_id,event_id) values($1,$2)',[pending,eventId]),/row-level security/);
    await assert.rejects(db.query('select public.save_content($1,$2)',[JSON.stringify(existing),'Unauthorized']),/Administrator access required/);
  });
  await saveAccess('public',false);
  await as('anon',null,async()=>assert.equal((await db.query('select * from public.content_details where content_id=$1',[eventId])).rows.length,0));
  await saveAccess('members');
  for(const [role,id] of [['anon',null],['authenticated',pending]])await as(role,id,async()=>assert.equal((await db.query('select * from public.content_details where content_id=$1',[eventId])).rows.length,0));
  await as('authenticated',member,async()=>assert.equal((await db.query('select * from public.content_details where content_id=$1',[eventId])).rows.length,1));
});
