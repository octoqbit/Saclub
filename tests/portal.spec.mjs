import { test, expect } from '@playwright/test';
import slots from '../content-slots.json' with {type:'json'};

const adminId='00000000-0000-4000-8000-000000000001',memberId='00000000-0000-4000-8000-000000000002',eventId='00000000-0000-4000-8000-000000000003',projectId='00000000-0000-4000-8000-000000000004';
async function mock(page,{role='admin',signedIn=false,status='approved',empty=false}={}){
  const profile={id:role==='admin'?adminId:memberId,email:`${role}@example.test`,name:role==='admin'?'Alex Admin':'Jamie Member',avatar:'boy',role,status,member_id:'SAC-CS-001',department:'CS',study_year:'2',interests:['Robotics'],motivation:'I want to build robots.',submitted_at:'2026-01-01',created_at:'2026-01-01'};
  const applicant={...profile,id:'00000000-0000-4000-8000-000000000005',name:'New Maker',email:'maker@example.test',role:'member',status:'pending',member_id:null};
  const user={id:profile.id,email:profile.email,aud:'authenticated',role:'authenticated',app_metadata:{provider:'email'},user_metadata:{},created_at:'2026-01-01'};
  const session={access_token:'test-access-token',refresh_token:'test-refresh-token',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,token_type:'bearer',user};
  const state={profile,items:empty?[]:[{id:eventId,kind:'event',slug:'future-build',title:'Future Build',summary:'Build something together.',image:'/about-assets/ai_hackathon.jpg',image_alt:'Robotics workshop',tags:['Robotics'],published:true,sort_order:1,data:{shortTitle:'FUTURE BUILD',subtitle:'A HANDS-ON WORKSHOP',startDate:'2099-01-01',endDate:'2099-01-02',location:'The lab',prizePool:'1,000',symbol:'01',accentColor:'#00e5ff',homeBeyond:true,homeExperience:true,registrationOpen:true}},{id:projectId,kind:'project',slug:'atlas',title:'Atlas Rover',summary:'Public rover preview.',image:'/showcase-assets/rover.jpg',image_alt:'Rover',tags:['Robotics'],published:true,sort_order:1,data:{category:'robotics',subtitle:'AUTONOMOUS EXPLORATION',status:'Concept',homeProject:true}}],values:{},registrations:[],calls:[],applicant,privateBody:'Members-only instructions. Bring your robot kit.'};
  if(signedIn)await page.addInitScript(session=>localStorage.setItem('sb-sac-test-auth-token',JSON.stringify(session)),session);
  await page.route('https://sac-test.supabase.co/**',async route=>{
    const req=route.request(),url=new URL(req.url()),path=url.pathname,method=req.method(),body=req.headers()['content-type']?.includes('application/json')?req.postDataJSON():null;
    state.calls.push({path,method,body});
    let data=[];
    if(method==='OPTIONS')return route.fulfill({status:200,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*'}});
    if(path.includes('/auth/v1/token'))data=session;
    else if(path.includes('/auth/v1/user'))data=user;
    else if(path.includes('/auth/v1/logout'))data={};
    else if(path.includes('/auth/v1/signup'))data={user:{...user,identities:[{}]},session:null};
    else if(path.includes('/auth/v1/recover'))data={};
    else if(path.endsWith('/profiles'))data=url.searchParams.has('id')?state.profile:[state.profile,state.applicant];
    else if(path.endsWith('/rpc/review_member')){state.applicant.status=body.decision;state.applicant.member_id='SAC-CS-002';data=null;}
    else if(path.endsWith('/rpc/save_profile')){state.profile.name=body.display_name;state.profile.avatar=body.emoji;data=null;}
    else if(path.endsWith('/rpc/save_content')){const item={...body.item,id:body.item.id||crypto.randomUUID()};state.items=state.items.filter(i=>i.id!==item.id).concat(item);state.privateBody=body.private_body;data=item.id;}
    else if(path.endsWith('/content_details'))data={body:state.privateBody};
    else if(path.endsWith('/site_content')){if(method==='POST'){for(const row of body)state.values[row.id]=row.value;}data=Object.entries(state.values).map(([id,value])=>({id,value}));}
    else if(path.endsWith('/content')){
      if(method==='DELETE'){state.items=state.items.filter(i=>`eq.${i.id}`!==url.searchParams.get('id'));data=null;}
      else data=state.items.filter(i=>(!url.searchParams.has('kind')||`eq.${i.kind}`===url.searchParams.get('kind'))&&(!url.searchParams.has('published')||i.published));
    }
    else if(path.endsWith('/registrations')){
      if(method==='POST')state.registrations.push({...body,created_at:new Date().toISOString(),content:{title:'Future Build'},profiles:{name:'Jamie',email:'member@example.test',member_id:'SAC-CS-001'}});
      if(method==='DELETE')state.registrations=[];
      data=req.headers().accept?.includes('application/vnd.pgrst.object+json')?(state.registrations[0]||null):state.registrations;
    }
    return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(data)});
  });
  return state;
}

test('admin login is clean on desktop and mobile; non-admin login is rejected',async({page},info)=>{
  await mock(page,{role:'member'});await page.goto('/admin');
  await expect(page.getByRole('heading',{name:'Welcome back.'})).toBeVisible();
  await page.screenshot({path:info.outputPath('admin-login-desktop.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});await expect(page.locator('body')).toHaveJSProperty('scrollWidth',390);
  await page.screenshot({path:info.outputPath('admin-login-mobile.png'),fullPage:true});
  await page.getByLabel('Admin ID (email)').fill('member@example.test');await page.getByLabel('Password',{exact:true}).fill('test-password-123');await page.getByRole('button',{name:'Sign in to admin'}).click();
  await expect(page.getByRole('alert')).toContainText('does not have administrator access');
});
test('admin can add and delete an event, edit website text, and review an applicant',async({page},info)=>{
  const state=await mock(page,{signedIn:true});await page.goto('/admin');
  await expect(page.getByRole('heading',{name:'Your club, at a glance.'})).toBeVisible();
  await page.screenshot({path:info.outputPath('admin-overview.png'),fullPage:true});
  await page.getByRole('button',{name:'Events',exact:true}).click();await page.getByRole('button',{name:'Add event',exact:true}).click();
  await page.getByLabel('Title',{exact:true}).fill('Circuit Jam');await page.getByLabel('Public introduction').fill('An evening for makers.');await page.getByLabel('Start date').fill('2099-01-01');await page.getByLabel('End date').fill('2099-01-02');await page.getByLabel('Full details').fill('Private workshop instructions.');await page.getByLabel('Published on the website').check();
  await page.getByRole('button',{name:'Save changes',exact:true}).click();await expect(page.getByRole('cell',{name:'Circuit Jam circuit-jam'})).toBeVisible();
  expect(state.items.find(i=>i.slug==='circuit-jam').published).toBe(true);
  await page.getByRole('button',{name:'Website content',exact:true}).click();await page.getByRole('button',{name:'Home · Beyond Circuits',exact:true}).click();
  await page.getByLabel('BEYOND',{exact:true}).fill('BEYOND TOMORROW ');await page.getByRole('button',{name:/Save changes/}).click();await expect(page.getByRole('status')).toContainText('Website content saved');
  await page.getByRole('button',{name:/^Members/}).click();await page.getByRole('button',{name:'Review',exact:true}).last().click();page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Approve & assign ID'}).click();await expect.poll(()=>state.applicant.status).toBe('approved');
  await page.goto('/');await expect(page.locator('.s2-giant-text')).toContainText('BEYOND TOMORROW');await expect(page.locator('.section-two .home-event-slide')).toHaveCount(2);
  await page.goto('/admin');await page.getByRole('button',{name:'Events',exact:true}).click();await page.getByRole('row').filter({hasText:'Circuit Jam'}).getByRole('button',{name:'Edit'}).click();page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Delete event'}).click();await expect.poll(()=>state.items.some(i=>i.slug==='circuit-jam')).toBe(false);
});
test('public previews remain public but full project and event details require login',async({page})=>{
  const state=await mock(page);await page.goto('/projects.html');await expect(page.getByText('Public rover preview.')).toBeVisible();
  await page.getByRole('button',{name:'Explore Atlas Rover'}).click();await expect(page).toHaveURL(/\/account\?next=/);expect(state.calls.filter(c=>c.path.endsWith('/content_details')).length).toBe(0);
  await page.goto('/events.html');await expect(page.locator('.ev-ticket')).toHaveCount(1);await page.getByRole('button',{name:'View details for Future Build'}).click();await expect(page).toHaveURL(/\/account\?next=/);
});
test('approved member can read details, register once, update emoji, and cancel',async({page},info)=>{
  const state=await mock(page,{role:'member',signedIn:true});await page.goto('/events.html');await page.getByRole('button',{name:'View details for Future Build'}).click();await expect(page.getByText('Members-only instructions. Bring your robot kit.')).toBeVisible();
  await page.getByRole('button',{name:'REGISTER FOR EVENT',exact:true}).click();await expect(page.getByRole('button',{name:'YOU’RE REGISTERED'})).toBeDisabled();expect(state.registrations.length).toBe(1);
  await page.goto('/account');await page.getByRole('radio',{name:'Girl',exact:true}).check();await page.getByRole('button',{name:'Save profile',exact:true}).click();await expect.poll(()=>state.profile.avatar).toBe('girl');await expect(page.getByRole('img',{name:'Pink robot avatar'})).toBeVisible();await page.screenshot({path:info.outputPath('robot-profile.png'),fullPage:true});
  page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Cancel',exact:true}).click();await expect.poll(()=>state.registrations.length).toBe(0);
});
test('empty database never resurrects deleted items and mobile admin has no overflow',async({page},info)=>{
  await mock(page,{signedIn:true,empty:true});await page.goto('/');await expect(page.locator('.home-event-slide')).toHaveCount(0);await expect(page.locator('.project-card')).toHaveCount(0);
  await page.goto('/events.html');await expect(page.getByRole('heading',{name:'NO SIGNAL. YET.'})).toBeVisible();await expect(page.locator('.ev-ticket')).toHaveCount(0);
  await page.setViewportSize({width:390,height:844});await page.goto('/admin');await expect(page.getByRole('heading',{name:'Your club, at a glance.'})).toBeVisible();await expect(page.locator('body')).toHaveJSProperty('scrollWidth',390);await page.screenshot({path:info.outputPath('admin-mobile.png'),fullPage:true});
});
test('CMS text hooks resolve to the intended text without replacing child markup',async({page})=>{
  await mock(page);for(const [path,prefix] of [['/','home-'],['/projects.html','projects-']]){
    await page.goto(path);await page.waitForLoadState('networkidle');
    const errors=await page.evaluate(slots=>slots.filter(s=>s.selector).flatMap(s=>{const el=document.querySelector(s.selector);if(!el)return [s.id+' missing'];if(s.type==='image')return [];const text=[...el.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE)[s.part];return text?.textContent.trim().replace(/\s+/g,' ')===s.default?[]:[s.id+' incorrect text'];}),slots.filter(s=>s.id.startsWith(prefix)));
    expect(errors).toEqual([]);
  }
});

test('applications collect a chosen password and emoji without requesting admin privileges',async({page})=>{
  const state=await mock(page);await page.goto('/join.html');
  await page.getByLabel('First Name').fill('Sam');await page.getByLabel('Last Name').fill('Maker');await page.getByLabel('Email',{exact:true}).fill('sam@example.test');await page.getByLabel('Department',{exact:true}).selectOption('cs');await page.getByLabel('Year of Study').selectOption('2');await page.getByLabel('Why do you want to join SAC?').fill('I want to learn robotics.');await page.getByLabel('Choose your password').fill('a-long-test-password');await page.getByRole('radio',{name:'Girl',exact:true}).check();await page.getByRole('button',{name:'SUBMIT APPLICATION'}).click();
  await expect(page.getByRole('status')).toContainText('Check your email');
  const signup=state.calls.find(c=>c.path.endsWith('/signup')).body;
  expect(signup.data.avatar).toBe('girl');expect(signup.data.name).toBe('Sam Maker');expect(signup.data.role).toBeUndefined();expect(signup.data.status).toBeUndefined();
});

test('pending member cannot open protected details and gets a useful status',async({page})=>{
  const state=await mock(page,{role:'member',signedIn:true,status:'pending'});await page.goto('/events.html');await page.getByRole('button',{name:'View details for Future Build'}).click();await expect(page).toHaveURL(/\/account/);await expect(page.getByRole('status')).toContainText('awaiting admin approval');expect(state.calls.filter(c=>c.path.endsWith('/content_details')).length).toBe(0);
});

test('edited event banner words and home button words persist without changing banner artwork',async({page})=>{
  const state=await mock(page);state.values['events-006']='BUILD YOUR NEXT';state.values['home-009-0']='DISCOVER THE LAB';await page.goto('/events.html');await expect(page.locator('#ev-title')).toContainText('BUILD YOUR NEXT');await expect(page.locator('.ev-hero-image')).toHaveAttribute('src',/banner_notext/);
  await page.goto('/');const button=page.locator('[data-cms="home-009"]');await expect(button).toHaveText('DISCOVER THE LAB');await button.hover();await page.mouse.move(0,0);await expect(button).toHaveText('DISCOVER THE LAB');
});
