import { test, expect } from '@playwright/test';
import slots from '../content-slots.json' with {type:'json'};

// Keep browser tests independent of external font availability.
test.beforeEach(async({page})=>{await page.route('https://fonts.googleapis.com/**',route=>route.abort());await page.route('https://fonts.gstatic.com/**',route=>route.abort());});

const adminId='00000000-0000-4000-8000-000000000001',memberId='00000000-0000-4000-8000-000000000002',eventId='00000000-0000-4000-8000-000000000003',projectId='00000000-0000-4000-8000-000000000004';
async function mock(page,{role='admin',signedIn=false,status='approved',empty=false}={}){
  const profile={id:role==='admin'?adminId:memberId,email:`${role}@example.test`,name:role==='admin'?'Alex Admin':'Jamie Member',avatar:role==='admin'?'technologist':'robot',pronouns:'he/him',role,status,member_id:'SAC-CS-001',department:'CS',study_year:'2',interests:['Robotics'],motivation:'I want to build robots.',submitted_at:'2026-01-01',created_at:'2026-01-01'};
  const applicant={...profile,id:'00000000-0000-4000-8000-000000000005',name:'New Maker',email:'maker@example.test',role:'member',status:'pending',member_id:null};
  const user={id:profile.id,email:profile.email,aud:'authenticated',role:'authenticated',app_metadata:{provider:'email'},user_metadata:{},created_at:'2026-01-01'};
  const session={access_token:'test-access-token',refresh_token:'test-refresh-token',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,token_type:'bearer',user};
  const state={profile,items:empty?[]:[{id:eventId,kind:'event',slug:'future-build',title:'Future Build',summary:'Build something together.',image:'/about-assets/ai_hackathon.jpg',image_alt:'Robotics workshop',tags:['Robotics'],published:true,sort_order:1,data:{shortTitle:'FUTURE BUILD',subtitle:'A HANDS-ON WORKSHOP',startDate:'2099-01-01',endDate:'2099-01-02',location:'The lab',prizePool:'1,000',symbol:'01',accentColor:'#00e5ff',homeBeyond:true,homeExperience:true,registrationOpen:true}},{id:projectId,kind:'project',slug:'atlas',title:'Atlas Rover',summary:'Public rover preview.',image:'/showcase-assets/rover.jpg',image_alt:'Rover',tags:['Robotics'],published:true,sort_order:1,data:{category:'robotics',subtitle:'AUTONOMOUS EXPLORATION',status:'Concept',homeProject:true}}],projectDetails:{},values:{},registrations:[],calls:[],applicant,privateBody:'Members-only instructions. Bring your robot kit.'};
  if(signedIn)await page.addInitScript(session=>localStorage.setItem('sb-sac-test-auth-token',JSON.stringify(session)),session);
  await page.route('https://sac-test.supabase.co/**',async route=>{
    const req=route.request(),url=new URL(req.url()),path=url.pathname,method=req.method(),body=req.headers()['content-type']?.includes('application/json')?req.postDataJSON():null;
    state.calls.push({path,method,body,url:req.url()});
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
    else if(path.endsWith('/rpc/save_content')){const item={...body.item,id:body.item.id||crypto.randomUUID()};if(item.kind==='project'){const keys=['category','subtitle','status','homeProject','heroFeatured','imageCaption'];state.projectDetails[item.id]=Object.fromEntries(Object.entries(item.data).filter(([key])=>!keys.includes(key)));item.data=Object.fromEntries(Object.entries(item.data).filter(([key])=>keys.includes(key)));}state.items=state.items.filter(i=>i.id!==item.id).concat(item);state.privateBody=body.private_body;data=item.id;}
    else if(path.endsWith('/content_details'))data={body:state.privateBody,data:state.projectDetails[url.searchParams.get('content_id')?.replace('eq.','')]||{}};
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
  await expect(page.getByRole('alert')).toContainText('Invalid login Credentials');
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
test('public project cards and banners remain visible, but opening details requires login',async({page})=>{
  const state=await mock(page);await page.goto('/projects.html');await expect(page.getByText('Public rover preview.')).toBeVisible();
  await expect(page.locator('[data-project-hero] img')).toBeVisible();
  await page.getByRole('link',{name:'Explore Atlas Rover'}).click();await expect(page).toHaveURL(/\/account\?next=/);
  expect(new URL(page.url()).searchParams.get('next')).toBe('/project.html?project=atlas');
  expect(state.calls.filter(c=>c.path.endsWith('/content_details')).length).toBe(0);
  await page.goto('/project.html?project=atlas');await expect(page).toHaveURL(/\/account\?next=/);
  expect(state.calls.filter(c=>c.path.endsWith('/content_details')).length).toBe(0);
  await page.goto('/events.html');await expect(page.locator('.ev-ticket')).toHaveCount(1);await page.getByRole('button',{name:'View details for Future Build'}).click();await expect(page).toHaveURL(/\/account\?next=/);
});

for(const status of ['pending','rejected','suspended'])test(`${status} users cannot open project details even with a cached member flag`,async({page})=>{
  const state=await mock(page,{role:'member',signedIn:true,status});
  await page.addInitScript(id=>localStorage.setItem('sac-approved-member',JSON.stringify({userId:id,approved:true})),memberId);
  await page.goto('/project.html?project=atlas');
  await expect(page).toHaveURL(/\/account\?next=/);
  expect(state.calls.filter(c=>c.path.endsWith('/content_details')).length).toBe(0);
  await expect(page.getByText('Members-only instructions. Bring your robot kit.')).toHaveCount(0);
});

test('approved members can open a project directly and read protected briefs',async({page})=>{
  const state=await mock(page,{role:'member',signedIn:true});
  state.projectDetails[projectId]={overview:'A protected build brief.',githubUrl:'https://github.com/SAclub/atlas'};
  await page.goto('/project.html?project=atlas');
  await expect(page.getByText('A protected build brief.')).toBeVisible();
  await expect(page.getByRole('link',{name:'VIEW ON GITHUB'})).toHaveAttribute('href','https://github.com/SAclub/atlas');
  await page.getByRole('button',{name:'Open member notes'}).click();
  await expect(page.locator('#member-notes-body')).toHaveText(state.privateBody);
});

test('failed protected project requests do not reveal legacy public detail fields',async({page})=>{
  const state=await mock(page,{role:'member',signedIn:true});
  state.items.find(item=>item.kind==='project').data.overview='Legacy exposed brief';
  await page.route('**/rest/v1/content_details?**',route=>route.fulfill({status:403,contentType:'application/json',body:JSON.stringify({message:'Access denied'})}));
  await page.goto('/project.html?project=atlas');
  await expect(page.getByRole('heading',{name:'Could not load this project.'})).toBeVisible();
  await expect(page.locator('#project-detail')).toBeHidden();
  await expect(page.getByText('Legacy exposed brief')).toHaveCount(0);
});

test('admin project edits persist in the detail page, card, and hero',async({page},info)=>{
  await page.addInitScript(()=>sessionStorage.setItem('sac_booted','true'));
  const state=await mock(page,{signedIn:true});await page.goto('/admin');
  await page.getByRole('button',{name:'Projects',exact:true}).click();
  await page.getByRole('row').filter({hasText:'Atlas Rover'}).getByRole('button',{name:'Edit'}).click();
  await page.getByLabel('Project overview',{exact:true}).fill('An editable rover brief for a supervised navigation experiment.');
  await page.getByLabel('Problem to solve').fill('Detect obstacles and stop predictably.');
  await page.getByLabel('Build approach').fill('Start with sensing, then validate navigation.');
  await page.getByLabel('Features · one per line').fill('Obstacle detection\nManual stop');
  await page.getByLabel('Components and technologies').fill('Microcontroller\nDistance sensor');
  await page.getByLabel('Milestones · one per line').fill('Assemble base\nTest movement');
  await page.getByLabel('Next steps').fill('Prepare a supervised trial.');
  await page.getByLabel('GitHub repository URL').fill('https://github.com/example/atlas');
  await page.getByLabel('Image URL',{exact:true}).fill('/showcase-assets/project-atlas.jpg');
  await page.getByLabel('Image caption',{exact:true}).fill('Rover concept illustration');
  await page.getByLabel('Feature near the start').check();
  await page.screenshot({path:info.outputPath('project-admin.png'),fullPage:true});
  await page.getByRole('button',{name:'Save changes',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Projects',exact:true})).toBeVisible();
  expect(state.items.find(i=>i.kind==='project').data.githubUrl).toBeUndefined();
  expect(state.projectDetails[projectId].githubUrl).toBe('https://github.com/example/atlas');
  await page.getByRole('row').filter({hasText:'Atlas Rover'}).getByRole('button',{name:'Edit'}).click();
  await expect(page.getByRole('textbox',{name:'Project overview',exact:true})).toHaveValue('An editable rover brief for a supervised navigation experiment.');
  await page.goto('/projects.html');
  await expect(page.locator('[data-project-hero] img')).toHaveAttribute('src','/showcase-assets/project-atlas.jpg');
  await expect(page.locator('.experiment-image img')).toHaveAttribute('src','/showcase-assets/project-atlas.jpg');
  await page.getByRole('link',{name:'Explore Atlas Rover'}).click();
  await expect(page.getByText('An editable rover brief for a supervised navigation experiment.')).toBeVisible();
  await expect(page.getByRole('link',{name:'VIEW ON GITHUB'})).toHaveAttribute('href','https://github.com/example/atlas');
  await expect(page.locator('#project-features li')).toHaveCount(2);
  await expect(page.locator('#project-milestones li')).toHaveCount(2);
  await page.getByRole('button',{name:'Open member notes'}).click();
  await expect(page.locator('#member-notes-body')).toHaveText(state.privateBody);
  await page.screenshot({path:info.outputPath('project-detail-desktop.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:info.outputPath('project-detail-mobile.png'),fullPage:true});
  await page.goto('/projects.html?project=atlas');
  await expect(page).toHaveURL(/\/project.html\?project=atlas/);
});

test('all original concepts have public artwork and protected member briefs',async({page},info)=>{
  await page.addInitScript(()=>sessionStorage.setItem('sac_booted','true'));
  const state=await mock(page,{role:'member',signedIn:true});
  const {projectDefaults}=await import('../lib/project-data.mjs');
  state.items=Object.keys(projectDefaults).map((slug,i)=>({id:`project-${i}`,slug,kind:'project',title:['ATLAS / ROVER','IRIS / VISION','PULSE / NETWORK','DEXTER / ARM'][i],summary:'A proposed SAC build.',image:i%2?'/showcase-assets/vision.jpg':'/showcase-assets/rover.jpg',image_alt:'Concept',tags:['Robotics'],published:true,sort_order:i,data:{category:'robotics',status:'Concept',homeProject:true}}));
  for(const item of state.items)state.projectDetails[item.id]=Object.fromEntries(['overview','challenge','approach','features','techStack','milestones','nextSteps'].map(key=>[key,`Member-only ${key} for ${item.title}`]));
  await page.goto('/projects.html');
  await expect(page.locator('.experiment-card')).toHaveCount(4);
  const images=await page.locator('.experiment-image img').evaluateAll(nodes=>nodes.map(n=>n.src));
  expect(new Set(images).size).toBe(4);
  await expect(page.locator('[data-project-hero] a')).toHaveCount(3);
  await page.screenshot({path:info.outputPath('project-collection.png'),fullPage:true});
  for(const item of state.items){
    await page.goto(`/project.html?project=${item.slug}`);
    await expect(page.getByRole('heading',{level:1})).toHaveText(item.title);
    await expect(page.locator('#project-brief .project-section')).toHaveCount(7);
    await expect(page.locator('#project-github')).toBeHidden();
    await expect(page.getByText('Repository link coming soon.')).toBeVisible();
    await expect(page.locator('#project-image')).toHaveJSProperty('naturalWidth',1400);
  }
  await page.setViewportSize({width:390,height:844});await page.goto('/projects.html');
  await expect(page.locator('[data-project-hero] a')).toHaveCount(3);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:info.outputPath('project-collection-mobile.png'),fullPage:true});
  const detailCalls=state.calls.filter(c=>c.path.endsWith('/content_details')).length;
  await page.goto('/project.html?project=missing');
  await expect(page.getByRole('heading',{name:'Project not found.'})).toBeVisible();
  expect(state.calls.filter(c=>c.path.endsWith('/content_details')).length).toBe(detailCalls);
});

test('unsafe repository links cannot be saved or rendered',async({page})=>{
  const state=await mock(page,{signedIn:true});await page.goto('/admin');
  await page.getByRole('button',{name:'Projects',exact:true}).click();
  await page.getByRole('row').filter({hasText:'Atlas Rover'}).getByRole('button',{name:'Edit'}).click();
  await page.getByLabel('GitHub repository URL').fill('https://github.com.evil.test/owner/repo');
  await page.getByRole('button',{name:'Save changes',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('Use a GitHub repository URL');
  expect(state.calls.some(c=>c.path.endsWith('/rpc/save_content'))).toBe(false);
  state.projectDetails[projectId]={githubUrl:'javascript:alert(1)'};
  await page.goto('/project.html?project=atlas');
  await expect(page.getByRole('heading',{name:'Atlas Rover'})).toBeVisible();
  await expect(page.locator('#project-github')).toBeHidden();
});
test('approved member can read details, register once, update emoji, and cancel',async({page},info)=>{
  const state=await mock(page,{role:'member',signedIn:true});await page.goto('/events.html');await page.getByRole('button',{name:'View details for Future Build'}).click();await expect(page.getByText('Members-only instructions. Bring your robot kit.')).toBeVisible();
  await page.getByRole('button',{name:'REGISTER FOR EVENT',exact:true}).click();await expect(page.getByRole('button',{name:'YOU’RE REGISTERED'})).toBeDisabled();expect(state.registrations.length).toBe(1);
  await page.goto('/account');await expect(page.getByLabel('Pronouns (fixed)')).toHaveValue('He/Him');await expect(page.getByLabel('Pronouns (fixed)')).toHaveAttribute('readonly','');await expect(page.getByRole('group',{name:'Your tech emoji'}).getByRole('radio')).toHaveCount(8);await page.getByRole('radio',{name:'Rocket',exact:true}).check();await page.getByRole('button',{name:'Save profile',exact:true}).click();await expect.poll(()=>state.profile.avatar).toBe('rocket');expect(state.profile.pronouns).toBe('he/him');await expect(page.getByRole('img',{name:'Rocket',exact:true})).toBeVisible();await page.screenshot({path:info.outputPath('robot-profile.png'),fullPage:true});
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
  await page.getByLabel('First Name').fill('Sam');await page.getByLabel('Last Name').fill('Maker');await page.getByLabel('Email',{exact:true}).fill('sam@example.test');await page.getByLabel('Department',{exact:true}).selectOption('cs');await page.getByLabel('Year of Study').selectOption('2');await page.getByLabel('Why do you want to join SAC?').fill('I want to learn robotics.');await page.getByLabel('Choose your password').fill('a-long-test-password');await page.getByRole('radio',{name:'She/Her',exact:true}).check();await page.getByRole('radio',{name:'Satellite',exact:true}).check();await page.getByRole('button',{name:'SUBMIT APPLICATION'}).click();
  await expect(page.getByRole('status')).toContainText('Check your email');
  const signup=state.calls.find(c=>c.path.endsWith('/signup')).body;
  expect(signup.data.avatar).toBe('satellite');expect(signup.data.pronouns).toBe('she/her');expect(state.calls.find(c=>c.path.endsWith('/signup')).url).toContain('redirect_to=https%3A%2F%2Fsaclub.tech%2Faccount%3Fmode%3Dlogin%26confirmed%3D1');expect(signup.data.name).toBe('Sam Maker');expect(signup.data.role).toBeUndefined();expect(signup.data.status).toBeUndefined();
});

test('pending member cannot open protected details and gets a useful status',async({page})=>{
  const state=await mock(page,{role:'member',signedIn:true,status:'pending'});await page.goto('/events.html');await page.getByRole('button',{name:'View details for Future Build'}).click();await expect(page).toHaveURL(/\/account/);await expect(page.getByRole('status')).toContainText('awaiting admin approval');expect(state.calls.filter(c=>c.path.endsWith('/content_details')).length).toBe(0);
});

test('edited event banner words and home button words persist without changing banner artwork',async({page})=>{
  const state=await mock(page);state.values['events-006']='BUILD YOUR NEXT';state.values['home-009-0']='DISCOVER THE LAB';await page.goto('/events.html');await expect(page.locator('#ev-title')).toContainText('BUILD YOUR NEXT');await expect(page.locator('.ev-hero-image')).toHaveAttribute('src',/banner_notext/);
  await page.goto('/');const button=page.locator('[data-cms="home-009"]');await expect(button).toHaveText('DISCOVER THE LAB');await button.hover();await page.mouse.move(0,0);await expect(button).toHaveText('DISCOVER THE LAB');
});


test('admin keeps the laptop-person emoji and cannot select a member emoji',async({page})=>{
  await mock(page,{signedIn:true});await page.goto('/account');
  await expect(page.getByRole('img',{name:'Administrator technologist'})).toBeVisible();
  await expect(page.getByRole('group',{name:'Your tech emoji'})).toHaveCount(0);
  await expect(page.getByLabel('Pronouns (fixed)')).toHaveAttribute('readonly','');
  await page.goto('/admin');
  await expect(page.locator('.admin-user').getByRole('img',{name:'Administrator technologist'})).toBeVisible();
});

test('confirmed email lands on login and failed links do not claim success',async({page})=>{
  const state=await mock(page,{role:'member',signedIn:true});
  await page.goto('/account?mode=login&confirmed=1');
  await expect(page.getByRole('heading',{name:'Good to see you.'})).toBeVisible();
  await expect(page.getByRole('status')).toContainText('Email confirmed. Sign in');
  expect(state.calls.some(c=>c.path.includes('/logout')&&c.url.includes('scope=local'))).toBe(true);
  await expect(page).toHaveURL(/account\?mode=login$/);
  await page.goto('/account?mode=login&confirmed=1#error=access_denied&error_description=Email+link+expired');
  await expect(page.getByRole('alert')).toContainText('Email link expired');
  await expect(page.getByText('Email confirmed. Sign in to your account.')).toHaveCount(0);
});

test('publishing requirement and emoji choices fit mobile and each page theme',async({page},info)=>{
  await mock(page,{role:'member',signedIn:true,status:'pending'});
  await page.addInitScript(()=>sessionStorage.setItem('sac_booted','true'));
  for(const width of [1440,390]){
    await page.setViewportSize({width,height:1000});
    for(const path of ['/account','/projects.html','/about.html','/terms.html','/privacy.html']){
      await page.goto(path);
      await expect(page.getByText(/All projects developed under SAC must be published/)).toBeVisible();
      await expect(page.getByRole('link',{name:'club’s official GitHub organization'})).toHaveAttribute('href','https://github.com/SAclub');
      await expect.poll(()=>page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,overflow:[...document.querySelectorAll('main > section')].filter(el=>el.getBoundingClientRect().right>innerWidth).map(el=>el.className)})),{message:`Layout at ${path}, ${width}px`}).toEqual({width,scrollWidth:width,overflow:[]});
      await page.getByText(/All projects developed under SAC must be published/).scrollIntoViewIfNeeded();
      await page.screenshot({path:info.outputPath(`${path.replaceAll('/','')}-${width}.png`)});
    }
  }
  await page.goto('/join.html');
  await expect(page.getByRole('group',{name:'Your tech emoji'}).getByRole('radio')).toHaveCount(8);
  await expect(page.getByRole('radio',{name:'He/Him',exact:true})).toBeDisabled();
  await page.getByRole('group',{name:'Your tech emoji'}).scrollIntoViewIfNeeded();
  await page.screenshot({path:info.outputPath('join-choices-mobile.png')});
});

test('guest project navigation bypasses the detail page and timed loaders',async({page})=>{
  const state=await mock(page);
  const documents=[];page.on('request',request=>{if(request.resourceType()==='document')documents.push(new URL(request.url()).pathname);});
  await page.goto('/projects.html');
  await expect(page.locator('#sac-global-loader')).toHaveCount(0);
  await expect(page.getByRole('link',{name:'Explore Atlas Rover'})).toBeVisible();
  await page.getByRole('link',{name:'Explore Atlas Rover'}).click();
  await expect(page.getByRole('heading',{name:'Good to see you.'})).toBeVisible();
  expect(documents).not.toContain('/project.html');
  expect(new URL(page.url()).searchParams.get('next')).toBe('/project.html?project=atlas');
  expect(state.calls.some(call=>call.path.includes('/auth/v1/user')||call.path.endsWith('/content_details'))).toBe(false);
  const bundles=[];page.on('request',request=>bundles.push(request.url()));
  await page.goto('/project.html?project=atlas');
  await expect(page).toHaveURL(/\/account\?next=/);
  expect(bundles.some(url=>url.includes('/project-detail.js'))).toBe(false);
});

test('project controls and cards do not wait for website copy',async({page})=>{
  await mock(page);
  await page.route('**/rest/v1/site_content?**',()=>{});
  await page.setViewportSize({width:390,height:844});
  await page.goto('/projects.html');
  await page.getByRole('button',{name:'Open navigation'}).click();
  await expect(page.getByRole('button',{name:'Close navigation'})).toHaveAttribute('aria-expanded','true');
  await expect(page.getByRole('link',{name:'Explore Atlas Rover'})).toBeVisible();
  await page.getByRole('button',{name:'AI & vision',exact:true}).click();
  await expect(page.locator('.filter-count')).toHaveText('0 concepts');
});

test('public event opens and closes immediately even with a slow detail request',async({page})=>{
  const state=await mock(page);state.items[0].data.access='public';
  await page.route('**/rest/v1/content_details?**',()=>{});
  await page.goto('/events.html');
  await page.getByRole('button',{name:'View details for Future Build'}).click();
  const dialog=page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Loading event details');
  await page.getByRole('button',{name:'Close event details'}).click();
  await expect(dialog).not.toBeVisible();
  await expect(page).toHaveURL(/events.html$/);
});

test('admin can switch event details between public and members only',async({page})=>{
  const state=await mock(page,{signedIn:true});await page.goto('/admin');
  await page.getByRole('button',{name:'Events',exact:true}).click();
  await page.getByRole('button',{name:'Edit',exact:true}).click();
  await expect(page.getByLabel('Event access')).toHaveValue('members');
  await page.getByLabel('Event access').selectOption('public');
  await page.getByRole('button',{name:'Save changes',exact:true}).click();
  await expect.poll(()=>state.items.find(i=>i.kind==='event').data.access).toBe('public');
  const guest=await page.context().browser().newPage();
  try {
    const guestState=await mock(guest);guestState.items=state.items;
    await guest.goto('http://127.0.0.1:5178/events.html?event=future-build');
    await expect(guest.getByRole('dialog')).toContainText(state.privateBody);
    await guest.getByRole('button',{name:'Close event details'}).click();
    await expect(guest.getByRole('dialog')).not.toBeVisible();
    await page.getByRole('button',{name:'Edit',exact:true}).click();
    await page.getByLabel('Event access').selectOption('members');
    await page.getByRole('button',{name:'Save changes',exact:true}).click();
    await expect.poll(()=>state.items.find(i=>i.kind==='event').data.access).toBe('members');
    guestState.items=state.items;
    await guest.reload();
    await expect(guest).toHaveURL(/\/account\?next=/);
    expect(new URL(guest.url()).searchParams.get('next')).toBe('/events.html?event=future-build');
  } finally { await guest.close(); }
});
