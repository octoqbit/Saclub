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
    create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth,public,storage to anon,authenticated;
    grant execute on function auth.uid() to anon,authenticated;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
    alter table storage.objects enable row level security;
    grant select,insert,delete on storage.objects to anon,authenticated;`);
  await db.exec(readFileSync('supabase/schema.sql','utf8'));
  await db.exec(readFileSync('supabase/seed.sql','utf8'));
  for(const [id,email] of [[admin,'admin@test.local'],[pending,'pending@test.local'],[member,'member@test.local']]) await db.query(`insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)`,[id,email,JSON.stringify({name:email,department:'CS',study_year:'2',motivation:'I like robots',role:'admin',status:'approved',avatar:'girl'})]);
  await db.query(`update public.profiles set role='admin',status='approved' where id=$1`,[admin]);
  await db.query(`update public.profiles set status='approved' where id=$1`,[member]);
  eventId=(await db.query(`update public.content set data=data||'{"startDate":"2099-01-01","endDate":"2099-01-02","registrationOpen":true}' where slug='genesis' returning id`)).rows[0].id;
  draftId=(await db.query(`insert into public.content(kind,slug,title,published) values('project','secret-draft','Secret draft',false) returning id`)).rows[0].id;
  await db.query(`insert into public.content_details values($1,'Private draft text')`,[draftId]);
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
  assert.equal(p.role,'member');assert.equal(p.status,'pending');assert.equal(p.avatar,'girl');assert(p.submitted_at);assert.equal(p.member_id,null);
});
test('anonymous visitors get published previews only',async()=>as('anon',null,async()=>{
  assert.equal((await db.query('select * from public.content')).rows.length,7);
  await assert.rejects(db.query('select * from public.content_details'),/permission denied/);
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
    const first=(await db.query('select member_id from public.profiles where id=$1',[pending])).rows[0].member_id;assert.match(first,/^SAC-\d+$/);
    await db.query("select public.review_member($1,'suspended')",[pending]);
    await db.query("select public.review_member($1,'approved')",[pending]);
    assert.equal((await db.query('select member_id from public.profiles where id=$1',[pending])).rows[0].member_id,first);
    await assert.rejects(db.query("select public.review_member($1,'approved')",[admin]),/own account/);
    await db.query("select public.review_member($1,'suspended')",[pending]);
  });
  await as('authenticated',pending,async()=>assert.equal((await db.query('select * from public.content_details')).rows.length,0));
});
test('admin save is atomic; published content and deletion respect foreign keys',async()=>as('authenticated',admin,async()=>{
  const item={kind:'project',slug:'test-project',title:'Test project',summary:'Public preview',image:'',image_alt:'',tags:['AI'],data:{category:'ai'},published:true,sort_order:10};
  const id=(await db.query('select public.save_content($1,$2) as id',[JSON.stringify(item),'Secret documentation'])).rows[0].id;
  assert.equal((await db.query('select body from public.content_details where content_id=$1',[id])).rows[0].body,'Secret documentation');
  await assert.rejects(db.query('select public.save_content($1,$2)',[JSON.stringify({...item,slug:'rollback-test'}),null]),/not-null constraint/);
  assert.equal((await db.query("select * from public.content where slug='rollback-test'")).rows.length,0);
  await db.query('delete from public.content where id=$1',[id]);
  assert.equal((await db.query('select * from public.content_details where content_id=$1',[id])).rows.length,0);
  await db.query("insert into public.site_content(id,value) values('home-title','Updated heading')");
  await db.query("insert into storage.objects(bucket_id,name) values('content-images','admin.png')");
}));
