import { supabase, configured, checked, currentProfile, setupMessage, accountURL } from './lib/supabase.js';
import './avatars.css';
import { techEmojis, profilePronouns } from './lib/profile-options.mjs';

const form=document.querySelector('.join-form');
const emojiChoices=document.getElementById('join-emojis');
for(const [id,emoji,label] of techEmojis){
  const choice=document.createElement('label'),input=document.createElement('input'),icon=document.createElement('span'),caption=document.createElement('span');
  input.type='radio';input.name='avatar';input.value=id;input.checked=id==='robot';input.required=true;
  icon.className='tech-emoji';icon.setAttribute('aria-hidden','true');icon.textContent=emoji;caption.textContent=label;
  choice.append(input,icon,caption);emojiChoices.append(choice);
}
if(configured)currentProfile().then(profile=>{
  const fixed=profile&&profilePronouns(profile);if(!fixed)return;
  for(const input of form.querySelectorAll('[name=pronouns]')){input.checked=input.value===fixed;input.disabled=true;}
  document.querySelector('#join-pronouns .choice-note').textContent='Your pronouns are already saved and cannot be changed here.';
}).catch(()=>{});
const message=document.createElement('p');message.setAttribute('role','status');message.style.cssText='padding:16px 0;line-height:1.6;white-space:pre-wrap';form.append(message);
const button=form.querySelector('[type=submit]');
if(!configured){message.textContent=setupMessage;button.disabled=true;}
form.addEventListener('submit',async e=>{
  e.preventDefault();if(!configured)return;button.disabled=true;message.textContent='Submitting your application…';
  try{
    const f=new FormData(form),name=`${f.get('firstName').trim()} ${f.get('lastName').trim()}`;
    const metadata={name,avatar:f.get('avatar'),pronouns:f.get('pronouns'),department:f.get('department'),study_year:f.get('year'),interests:f.getAll('interest'),motivation:f.get('motivation').trim()};
    const existing=await currentProfile();
    if(existing){if(existing.submitted_at||existing.status!=='pending')throw new Error('You already have an account or application. Open your account to check its status.');checked(await supabase.rpc('submit_application',{display_name:name,emoji:metadata.avatar,department_name:metadata.department,year_value:metadata.study_year,interest_values:metadata.interests,reason:metadata.motivation,member_pronouns:profilePronouns(existing)||metadata.pronouns}));message.textContent='Application submitted for admin review. Open your account to check your status.';}
    else{const data=checked(await supabase.auth.signUp({email:f.get('email').trim(),password:f.get('password'),options:{data:metadata,emailRedirectTo:accountURL('?mode=login&confirmed=1')}}));if(data.user?.identities?.length===0){message.textContent='If this email already has an account, sign in or reset your password. Otherwise check your email to confirm your application.';}else{message.textContent=data.session?'Application submitted for admin review. Open your account to check your status.':'Check your email to confirm your address. Your application will be reviewed by the admin team.';}}
    form.reset();const link=document.createElement('a');link.href='/account';link.textContent='Open your account →';link.style.display='block';message.append(link);
  }catch(e){message.textContent=e.message;}finally{button.disabled=false;}
});
