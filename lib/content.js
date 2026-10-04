import { supabase, checked } from './supabase.js';
import { events } from '../events-data.mjs';
import hackathon from '../about-assets/ai_hackathon.jpg';
import rover from '../showcase-assets/rover.jpg';
import vision from '../showcase-assets/vision.jpg';
export const fallbackEvents = events.map((event,i) => ({ id:event.id, slug:event.id,kind:'event',title:event.title,summary:event.description,image:{hackathon,robotics:rover,iot:vision}[event.image],image_alt:event.title,tags:event.tags,published:true,sort_order:i,data:{...event,homeBeyond:true,homeExperience:true,registrationOpen:false} }));
export const fallbackProjects = [
  ['rover','ATLAS / ROVER','A little machine. A world to figure out.','robotics','AUTONOMOUS EXPLORATION',rover],
  ['vision','IRIS / VISION','Teaching a machine to notice the details.','ai','COMPUTER VISION',vision],
  ['signal','PULSE / NETWORK','Small signals. A bigger picture.','iot','CONNECTED ENVIRONMENTS',vision],
  ['arm','DEXTER / ARM','From a line of code to a precise movement.','robotics','MOTION & CONTROL',rover],
].map(([slug,title,summary,category,subtitle,image],i)=>({id:slug,slug,kind:'project',title,summary,image,image_alt:title,tags:[category],published:true,sort_order:i,data:{category,subtitle,status:'Concept',homeProject:true}}));
export async function loadContent(kind) {
  if (!supabase) return kind==='event' ? fallbackEvents : fallbackProjects;
  return checked(await supabase.from('content').select('*').eq('kind',kind).eq('published',true).order('sort_order').order('title'));
}
export function asEvent(item) {
  return {...item.data,id:item.id,slug:item.slug,title:item.title,description:item.summary,tags:item.tags,image:item.image,imageAlt:item.image_alt,
    shortTitle:item.data.shortTitle || item.title, accentColor:item.data.accentColor || '#00e5ff',symbol:item.data.symbol || 'SAC',prizePool:item.data.prizePool || '—',
    date:item.data.date || `${item.data.startDate} – ${item.data.endDate}`};
}
export function imageURL(value) {
  if (!value) return '';
  if (/^https:\/\//i.test(value) || /^\/(?!\/)/.test(value) || /^(about-assets|showcase-assets)\/[\w./-]+$/.test(value)) return value;
  return '';
}
export function node(tag,className,text) { const el=document.createElement(tag); if(className)el.className=className; if(text!==undefined)el.textContent=text; return el; }
