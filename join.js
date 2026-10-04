import { supabase, configured, checked, currentProfile, setupMessage } from './lib/supabase.js';
import './avatars.css';

const form=document.querySelector('.join-form');
const message=document.createElement('p');message.setAttribute('role','status');message.style.cssText='padding:16px 0;line-height:1.6;white-space:pre-wrap';form.append(message);
const button=form.querySelector('[type=submit]');
if(!configured){message.textContent=setupMessage;button.disabled=true;}
form.addEventListener('submit',async e=>{
  e.preventDefault();if(!configured)return;button.disabled=true;message.textContent='Submitting your application…';
  try{
    const f=new FormData(form),name=`${f.get('firstName').trim()} ${f.get('lastName').trim()}`;
    const metadata={name,avatar:f.get('avatar'),department:f.get('department'),study_year:f.get('year'),interests:f.getAll('interest'),motivation:f.get('motivation').trim()};
    const existing=await currentProfile();
    if(existing){if(existing.submitted_at||existing.status!=='pending')throw new Error('You already have an account or application. Open your account to check its status.');checked(await supabase.rpc('submit_application',{display_name:name,emoji:metadata.avatar,department_name:metadata.department,year_value:metadata.study_year,interest_values:metadata.interests,reason:metadata.motivation}));message.textContent='Application submitted for admin review. Open your account to check your status.';}
    else{const data=checked(await supabase.auth.signUp({email:f.get('email').trim(),password:f.get('password'),options:{data:metadata,emailRedirectTo:`${location.origin}/account`}}));if(data.user?.identities?.length===0){message.textContent='If this email already has an account, sign in or reset your password. Otherwise check your email to confirm your application.';}else{message.textContent=data.session?'Application submitted for admin review. Open your account to check your status.':'Check your email to confirm your address. Your application will be reviewed by the admin team.';}}
    form.reset();const link=document.createElement('a');link.href='/account';link.textContent='Open your account →';link.style.display='block';message.append(link);
  }catch(e){message.textContent=e.message;}finally{button.disabled=false;}
});
