import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowUpRight, ArrowDown, Calendar, MapPin, Search, Radio, Zap, Cpu, MoveUpRight, X, Pause, Play, Download } from 'lucide-react';
import { localDay, eventStatus, filterEvents, nextEvent, daysUntil, calendarFile } from './events-data.mjs';
import { loadContent, asEvent, imageURL } from './lib/content.js';
import { hasSessionHint, loginHref } from './lib/session-hint.js';
import { supabase, checked, requireMember } from './lib/supabase.js';
import { initializeMemberCta } from './lib/member-cta.js';
initializeMemberCta();
import { loadSiteValues } from './lib/site-content.js';
import bannerImage from './about-assets/banner_notext.jpg';

function downloadCalendar(event) {
  const url = URL.createObjectURL(new Blob([calendarFile(event)], { type: 'text/calendar;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = `sac-${event.id}.ics`;
  document.body.append(anchor); anchor.click(); anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function EventCard({ event, onOpen, paused, day }) {
  const ref = useRef(null);
  const status = eventStatus(event, day);
  function tilt(e) {
    if (paused || e.pointerType !== 'mouse') return;
    const box = ref.current.getBoundingClientRect();
    ref.current.style.setProperty('--tilt-x', `${((e.clientX - box.left) / box.width - .5) * 6}deg`);
    ref.current.style.setProperty('--tilt-y', `${((e.clientY - box.top) / box.height - .5) * -6}deg`);
  }
  function resetTilt() { ref.current.style.setProperty('--tilt-x', '0deg'); ref.current.style.setProperty('--tilt-y', '0deg'); }
  return <motion.article layout={!paused} initial={false} className="ev-ticket" style={{ '--event-accent': event.accentColor }}>
    <div ref={ref} className="ev-ticket-shell" onPointerMove={tilt} onPointerLeave={resetTilt}>
      <div className="ev-ticket-top"><span>SAC / {event.symbol}</span><span><i />{status.toUpperCase()}</span></div>
      <div className="ev-ticket-image"><img src={imageURL(event.image)} alt={event.imageAlt||event.title} loading="lazy" width="1536" height="1024" /><span className="ev-image-word" aria-hidden="true">{event.tags[0]}</span><span className="ev-ticket-sticker">{status === 'Past' ? 'BEEN THERE.\nBUILT THAT.' : 'BRING YOUR\nWHAT IF.'}</span><div className="ev-image-scan" aria-hidden="true" /></div>
      <div className="ev-ticket-copy"><span className="ev-kicker">{event.subtitle}</span><h3>{event.shortTitle}</h3><p>{event.description}</p><div className="ev-facts"><span><Calendar size={14} aria-hidden="true" />{event.date}</span><span><MapPin size={14} aria-hidden="true" />{event.location}</span></div><div className="ev-tags"><span>{event.access==='public'?'Public event':'Members only'}</span>{event.tags.map(tag => <span key={tag}>{tag}</span>)}</div></div>
      <div className="ev-ticket-tear" aria-hidden="true"><span /><i /><span /></div>
      <div className="ev-ticket-bottom"><div><span className="ev-kicker">{status === 'Past' ? 'LISTED PRIZE POOL' : 'PRIZES WORTH'}</span><strong>₹{event.prizePool}<small>*</small></strong></div><button type="button" className="ev-open" onClick={() => onOpen(event)} aria-label={`View details for ${event.title}`}><ArrowUpRight aria-hidden="true" /></button></div>
      <button className="ev-ticket-link" type="button" onClick={() => onOpen(event)}>{status === 'Past' ? 'OPEN THE ARCHIVE' : 'GET THE FULL BRIEF'}<span aria-hidden="true">↗</span></button>
    </div>
  </motion.article>;
}

function EventDialog({ event, onClose, day }) {
  const dialog = useRef(null);
  const [detail,setDetail]=useState(null),[detailError,setDetailError]=useState(''),[retry,setRetry]=useState(0);
  useEffect(()=>{
    setDetail(null);setDetailError('');
    if(!event)return;
    let active=true;
    const request=supabase?supabase.from('content_details').select('body').eq('content_id',event.id).maybeSingle():Promise.resolve({data:{body:''}});
    request.then(result=>{const row=checked(result);if(!row)throw new Error('Event details are unavailable.');if(active)setDetail(row.body||'');}).catch(()=>{if(active)setDetailError('Could not open event details. Please try again.');});
    return()=>{active=false;};
  },[event?.id,retry]);
  const [registered,setRegistered]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  useEffect(()=>{setRegistered(false);setMessage('');if(!event?.profile)return;let active=true;supabase.from('registrations').select('event_id').eq('event_id',event.id).eq('user_id',event.profile.id).maybeSingle().then(r=>{const data=checked(r);if(active)setRegistered(!!data);}).catch(e=>{if(active)setMessage(e.message);});return()=>{active=false;};},[event]);
  async function register(){setBusy(true);setMessage('');try{const profile=await requireMember(`/events.html?event=${encodeURIComponent(event.slug)}`);if(!profile)return;checked(await supabase.from('registrations').insert({event_id:event.id,user_id:profile.id}));setRegistered(true);setMessage('You’re registered! Find this event in your account.');}catch(e){if(e.code==='23505'){setRegistered(true);setMessage('You’re already registered for this event.');}else setMessage(e.message);}finally{setBusy(false);}}
  useEffect(() => {
    if (!event) return;
    const opener = document.activeElement;
    dialog.current.showModal();
    document.body.classList.add('ev-dialog-open');
    return () => { document.body.classList.remove('ev-dialog-open'); opener?.focus(); };
  }, [event]);
  if (!event) return null;
  return <dialog ref={dialog} className="ev-dialog" style={{ '--event-accent': event.accentColor }} aria-labelledby="ev-dialog-title" onClose={onClose} onClick={e => {
    if (e.target !== e.currentTarget) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) e.currentTarget.close();
  }}>
    <button className="ev-dialog-close" type="button" aria-label="Close event details" onClick={() => dialog.current.close()}><X /></button>
    <span className="ev-kicker">TRANSMISSION {event.symbol} / {eventStatus(event, day).toUpperCase()}</span><h2 id="ev-dialog-title">{event.title}</h2>
    <div className="ev-facts"><span><Calendar size={16} />{event.date}</span><span><MapPin size={16} />{event.location}</span></div><p>{event.description}</p><div className="ev-tags"><span>{event.access==='public'?'Public event':'Members only'}</span>{event.tags.map(tag => <span key={tag}>{tag}</span>)}</div>
    {detailError?<p role="alert">{detailError} <button type="button" onClick={()=>setRetry(value=>value+1)}>Try again</button></p>:detail===null?<p role="status">Loading event details…</p>:<p style={{whiteSpace:'pre-wrap'}}>{detail||'More details will be shared by the club.'}</p>}<div className="ev-dialog-prize"><span>LISTED PRIZE POOL</span><strong>₹{event.prizePool}*</strong></div><p className="ev-dialog-note">*Prize pool as listed. Saving dates does not register you for the event.</p>
    <p role="status">{message}</p><div className="ev-dialog-actions">{event.registrationOpen&&eventStatus(event,day)!=='Past'?<button type="button" className="ev-button" disabled={busy||registered} onClick={register}>{registered?'YOU’RE REGISTERED':busy?'REGISTERING…':'REGISTER FOR EVENT'}</button>:<span className="ev-dialog-note">Registration is closed.</span>}<button type="button" className="ev-button" onClick={() => downloadCalendar(event)}><Download size={16} />SAVE DATES (.ICS)</button><a className="ev-text-link" href="/account">MY ACCOUNT <ArrowUpRight size={16} /></a></div>
  </dialog>;
}

function EventsPage() {
  const [events,setEvents]=useState([]),[contentError,setContentError]=useState(''),[loading,setLoading]=useState(true),[opening,setOpening]=useState(false),[copyValues,setCopyValues]=useState({});
  const copy=(id,fallback)=>copyValues[id]??fallback;
  async function openEvent(event){
    if(opening)return;
    setContentError('');
    if(event.access==='public'){setSelected(event);return;}
    const next=`/events.html?event=${encodeURIComponent(event.slug)}`;
    if(!hasSessionHint()){location.assign(loginHref(next));return;}
    setOpening(true);
    try{const profile=await requireMember(next);if(profile)setSelected({...event,profile});}
    catch{setContentError('Could not verify membership. Please try again.');}
    finally{setOpening(false);}
  }
  useEffect(()=>{loadContent('event').then(rows=>{const list=rows.map(asEvent);setEvents(list);const slug=new URLSearchParams(location.search).get('event');const found=list.find(e=>e.slug===slug);if(found)openEvent(found);}).catch(e=>setContentError('Events could not be loaded. Please refresh to try again.')).finally(()=>setLoading(false));loadSiteValues().then(setCopyValues).catch(()=>{});},[]);
  const reducedMotion = useReducedMotion();
  const [manualPause, setManualPause] = useState(false);
  const paused = Boolean(reducedMotion) || manualPause;
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [day, setDay] = useState(localDay);
  useEffect(() => { const timer = setInterval(() => setDay(localDay()), 60000); return () => clearInterval(timer); }, []);
  const next = nextEvent(events, day);
  const visible = filterEvents(events, filter, query, day);
  const upcoming = events.filter(event => eventStatus(event, day) !== 'Past').length;
  return <div className={`ev-world${paused ? ' ev-motion-paused' : ''}`}>
    <div className="ev-atmosphere" aria-hidden="true"><div /><div /></div>
    <section className="ev-hero" aria-labelledby="ev-title">
      <div className="ev-topline"><span><Radio size={13} />{copy("events-001", "SAC / LIVE TRANSMISSIONS & ARCHIVES")}</span><span>{copy("events-002", "LESS SPECTATING. MORE PARTICIPATING.")}</span></div>
      <div className="ev-hero-frame">
        <img className="ev-hero-image" src={bannerImage} alt="Neon robotics lab with glowing circuits and robotic arms." width="1024" height="1024" fetchPriority="high" />
        <div className="ev-hero-shade" /><div className="ev-scanlines" aria-hidden="true" />
        <div className="ev-orbit-sticker" aria-hidden="true"><span>{copy("events-003", "MAKE SOME")}</span><Zap /><strong>{copy("events-004", "NOISE.")}</strong></div>
        <div className="ev-hero-copy"><p className="ev-kicker"><i />{copy("events-005", "YOUR NEXT GOOD STORY STARTS HERE.")}</p><h1 id="ev-title">{copy("events-006", "EVENTS THAT")}<br />{copy("events-007", "HIT ")}<span>{copy("events-008", "DIFFERENT.")}</span></h1><p>{copy("events-009", "Hack it. Build it. Battle it out.")}<br />{copy("events-010", "Bring your people. Leave with a story.")}</p><a className="ev-button" href="#event-board">{copy("events-011", "FIND YOUR NEXT THING ")}<ArrowDown size={18} /></a></div>
        <div className="ev-hero-side" aria-hidden="true">{copy("events-012", "CURIOSITY / AT FULL VOLUME")}</div>
        <div className="ev-hero-coordinates" aria-hidden="true">{copy("events-013", "SIGNAL: STRONG ")}<span>///</span>{copy("events-014", " ENERGY: UNREASONABLE")}</div>
      </div>
      <div className="ev-next-ticket"><div className="ev-next-icon"><Radio aria-hidden="true" /></div><div className="ev-next-copy"><span className="ev-kicker">{next ? 'NEXT ON THE RADAR' : 'THE RADAR IS QUIET'}</span><strong>{next ? next.title : 'More good things to come.'}</strong><span>{next ? `${next.date} / ${next.location}` : 'Explore the archive while we wait for the next transmission.'}</span></div>{next && <><div className="ev-countdown"><strong>{String(daysUntil(next, day)).padStart(2, '0')}</strong><span>{daysUntil(next, day) ? 'DAYS TO GO' : 'HAPPENING NOW'}</span></div><button type="button" className="ev-next-open" onClick={() => openEvent(next)} aria-label={`View next event: ${next.title}`}><ArrowUpRight /></button></>}</div>
    </section>
    <div className="ev-ticker" aria-hidden="true"><div>{[0, 1].map(n => <span key={n}>{copy("events-015", "GOOD IDEAS. LOUD ENERGY. ")}<b>✳</b>{copy("events-016", " BUILD SOMETHING WORTH TALKING ABOUT. ")}<b>✳</b>&nbsp;</span>)}</div></div>
    <section className="ev-board" id="event-board" aria-labelledby="ev-board-title">
      <div className="ev-board-heading"><div><span className="ev-kicker">{copy("events-017", "01 / PICK YOUR FREQUENCY")}</span><h2 id="ev-board-title">{copy("events-018", "THE EVENT")}<br /><span>{copy("events-019", "PLAYGROUND.")}</span></h2></div><div className="ev-board-meta"><span><b>{String(events.length).padStart(2, '0')}</b>{copy("events-020", " TRANSMISSIONS")}</span><span><b>{String(upcoming).padStart(2, '0')}</b>{copy("events-021", " UPCOMING / LIVE")}</span><p>{copy("events-022", "Different ways to get a little")}<br />{copy("events-023", "out of your comfort zone.")}</p></div></div>
      <div className="ev-toolbar"><div className="ev-filters" role="group" aria-label="Filter events">{[['all', 'ALL SIGNALS', events.length], ['upcoming', 'UPCOMING', upcoming], ['past', 'THE ARCHIVE', events.length - upcoming]].map(([key, label, count]) => <button type="button" key={key} aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}<span>{count}</span></button>)}</div><label className="ev-search"><Search size={17} aria-hidden="true" /><span className="ev-sr-only">{copy("events-024", "Search events by name, topic, or venue")}</span><input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Find your frequency…" /></label></div>
      <div className="ev-results" role="status">{visible.length} {visible.length === 1 ? 'event' : 'events'} on this frequency <span aria-hidden="true">↘</span></div>
      {contentError&&<p role="alert">{contentError}</p>}{(loading||opening)&&<p role="status">{loading?'Loading events…':'Opening member details…'}</p>}<div className="ev-ticket-grid">{visible.map(event => <EventCard key={event.id} event={event} onOpen={openEvent} paused={paused} day={day} />)}</div>
      {!loading&&!contentError&&!visible.length && <div className="ev-empty"><Radio size={38} /><h3>{copy("events-025", "NO SIGNAL. YET.")}</h3><p>{copy("events-026", "Try another name, topic, or event filter.")}</p><button type="button" className="ev-button" onClick={() => { setFilter('all'); setQuery(''); }}>{copy("events-027", "RESET THE FREQUENCY ")}<Zap size={16} /></button></div>}
      <p className="ev-art-note">{copy("events-028", "Promotional and concept artwork. Event details are shown as listed.")}</p>
    </section>
    <section className="ev-playbook"><div><span className="ev-kicker">{copy("events-029", "02 / YOUR ONLY ASSIGNMENT")}</span><h2>{copy("events-030", "SHOW UP.")}<br /><span>{copy("events-031", "GEEK OUT.")}</span></h2><p>{copy("events-032", "You don’t have to know everything.")}<br />{copy("events-033", "You just have to be curious about something.")}</p></div><div className="ev-playbook-steps"><article><span>01</span><div><h3>{copy("events-034", "Pick your rabbit hole.")}</h3><p>{copy("events-035", "Code, circuits, or a robot with an attitude. Follow the thing that pulls you in.")}</p></div><Cpu aria-hidden="true" /></article><article><span>02</span><div><h3>{copy("events-036", "Find your accomplices.")}</h3><p>{copy("events-037", "Bring a friend, or meet someone who asks the same strange questions.")}</p></div><Radio aria-hidden="true" /></article><article><span>03</span><div><h3>{copy("events-038", "Make a little noise.")}</h3><p>{copy("events-039", "Try something. Share the messy version. Give someone else an idea.")}</p></div><Zap aria-hidden="true" /></article></div></section>
    <section className="ev-cta"><span className="ev-kicker">{copy("events-040", "THE BEST PART IS WHO YOU MEET.")}</span><a href="join.html">{copy("events-041", "COME FOR THE TECH.")}<br /><span>{copy("events-042", "STAY FOR THE PEOPLE.")}</span><MoveUpRight aria-hidden="true" /></a><div className="ev-footer"><a href="index.html">{copy("events-043", "SAC / SENSING & AUTOMATION CLUB")}</a><nav aria-label="Events footer navigation"><a href="projects.html">{copy("events-044", "PROJECTS ↗")}</a><a href="team.html">{copy("events-045", "THE CREW ↗")}</a><button type="button" data-help-center="" aria-haspopup="dialog" aria-controls="sac-help-center" aria-expanded="false" className="help-center-trigger">Help Center</button><a href="privacy.html">Privacy Policy</a><a href="cookies.html">Cookie Policy</a><a href="terms.html">Terms of Service</a></nav><span>{copy("events-046", "© 2026 SAC")}</span></div></section>
    <button type="button" className="ev-motion-toggle" aria-pressed={paused} disabled={Boolean(reducedMotion)} onClick={() => setManualPause(value => !value)}>{paused ? <Play size={12} /> : <Pause size={12} />}{reducedMotion ? 'REDUCED MOTION' : paused ? 'RESUME MOTION' : 'PAUSE MOTION'}</button>
    <EventDialog event={selected} day={day} onClose={() => setSelected(null)} />
  </div>;
}

createRoot(document.getElementById('events-root')).render(<EventsPage />);

const menuButton = document.getElementById('mobile-menu-btn');
const menuLinks = document.getElementById('mobile-nav-links');
function setMenu(open) { menuButton.setAttribute('aria-expanded', String(open)); menuButton.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation'); menuButton.classList.toggle('active', open); menuLinks.classList.toggle('menu-open', open); }
menuButton.addEventListener('click', () => setMenu(menuButton.getAttribute('aria-expanded') !== 'true'));
menuLinks.addEventListener('click', e => { if (e.target.closest('a')) setMenu(false); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && menuButton.getAttribute('aria-expanded') === 'true') { setMenu(false); menuButton.focus(); } });
