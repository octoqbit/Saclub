import { loadContent, node, imageURL } from './content.js';
import { applySiteContent } from './site-content.js';
function imageFor(item){const img=node('img');img.src=imageURL(item.image);img.alt=item.image_alt||item.title;img.loading='lazy';img.width=640;img.height=400;return img;}
export async function initializeHome(){
  await applySiteContent();
  try{
    const [events,projects]=await Promise.all([loadContent('event'),loadContent('project')]);
    document.querySelectorAll('[data-event-carousel]').forEach((carousel,index)=>{
      const list=events.filter(e=>e.data[index===0?'homeBeyond':'homeExperience']);
      const track=carousel.querySelector('.home-event-track'),dots=carousel.querySelector('.home-event-dots');
      track.replaceChildren();dots.replaceChildren();
      list.forEach((item,i)=>{
        const slide=node('article','home-event-slide');slide.setAttribute('role','group');slide.setAttribute('aria-roledescription','slide');slide.setAttribute('aria-label',`${i+1} of ${list.length}`);
        const copy=node('div','home-event-copy');copy.append(node('span','home-event-tag',item.tags.join(' / ')),node('h4','',item.title),node('p','home-event-date',item.data.date||item.data.startDate),node('p','',item.summary));
        const link=node('a','','VIEW EVENT DETAILS ↗');link.href=`/events.html?event=${encodeURIComponent(item.slug)}`;copy.append(link);slide.append(imageFor(item),copy);track.append(slide);
        const dot=node('button');dot.type='button';dot.dataset.eventDot=String(i);dot.setAttribute('aria-label',`Show slide ${i+1}`);dots.append(dot);
      });
      carousel.querySelector('.home-event-controls').hidden=list.length<2;
      if(!list.length){const empty=node('div','home-event-copy');empty.append(node('h4','','New experiences are on the way.'),node('p','','Check back for the next event.'));track.append(empty);}
    });
    const slider=document.querySelector('#projects-slider');slider.replaceChildren();
    for(const item of projects.filter(p=>p.data.homeProject)){
      const card=node('a','project-card');card.href=`/projects.html?project=${encodeURIComponent(item.slug)}#lab-index`;
      const body=node('div','pc-body');body.style.cssText='position:relative;isolation:isolate;overflow:hidden';const img=imageFor(item);img.style.cssText='position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:-1;opacity:.25';body.append(img,node('h2','',item.title));
      const stats=node('div','pc-stats');stats.style.cssText='display:block;min-height:130px;padding:22px';stats.append(node('p','',item.summary),node('span','',`${item.tags.join(' / ')} ↗`));card.append(node('div','pc-header',item.data.status||'Project'),body,stats);slider.append(card);
    }
    const count=document.querySelector('.ap-num');if(count)count.textContent=String(projects.length).padStart(2,'0');
    if(!slider.children.length)slider.append(node('p','','New projects are on the way.'));
  }catch(error){console.error(error);document.querySelectorAll('.home-event-track, #projects-slider').forEach(el=>el.replaceChildren(node('p','','Content could not be loaded. Please refresh to try again.')));}
}
export async function initializeProjects(){
  await applySiteContent();
  if(!document.body.classList.contains('project-world'))return [];
  const grid=document.querySelector('.experiment-grid');
  try{
    const items=await loadContent('project');grid.replaceChildren();
    for(const [index,item] of items.entries()){
      const card=node('article','experiment-card');card.dataset.category=item.data.category;card.dataset.reveal='';
      const button=node('button','experiment-open');button.type='button';button.dataset.detail=item.slug;button.setAttribute('aria-label',`Explore ${item.title}`);
      const picture=node('div','experiment-image');picture.append(imageFor(item),node('span','image-index mono',`EXP—${String(index+1).padStart(2,'0')}`),node('span','image-badge mono',item.data.category),node('span','image-open','↗'));
      const info=node('div','experiment-info'),title=node('div');title.append(node('span','eyebrow',item.data.subtitle),node('h3','',item.title));info.append(title,node('span','concept-tag',item.data.status));button.append(picture,info,node('p','',item.summary));card.append(button);grid.append(card);
    }
    document.querySelector('[data-filter="all"] span').textContent=String(items.length).padStart(2,'0');document.querySelector('.filter-count').textContent=`${items.length} concepts`;
    if(!items.length)grid.append(node('p','','New projects are on the way.'));
    return items;
  }catch(error){grid.replaceChildren(node('p','','Projects could not be loaded. Please refresh to try again.'));return [];}
}
