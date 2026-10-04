import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowUpRight, ArrowDown, Calendar, MapPin, Search, Radio, Zap, Cpu, MoveUpRight, X, Pause, Play, Download } from 'lucide-react';
import { events, localDay, eventStatus, filterEvents, nextEvent, daysUntil, calendarFile } from './events-data.mjs';
import bannerImage from './about-assets/banner_notext.jpg';
import hackathonImage from './about-assets/ai_hackathon.jpg';
import roboticsImage from './showcase-assets/rover.jpg';
import iotImage from './showcase-assets/vision.jpg';
const images = { hackathon: hackathonImage, robotics: roboticsImage, iot: iotImage };

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
      <div className={`ev-ticket-image ev-image-${event.image}`}><img src={images[event.image]} alt={`${event.shortTitle} promotional concept artwork`} loading="lazy" width="1536" height="1024" /><span className="ev-image-word" aria-hidden="true">{event.tags[0]}</span><span className="ev-ticket-sticker">{status === 'Past' ? 'BEEN THERE.\nBUILT THAT.' : 'BRING YOUR\nWHAT IF.'}</span><div className="ev-image-scan" aria-hidden="true" /></div>
      <div className="ev-ticket-copy"><span className="ev-kicker">{event.subtitle}</span><h3>{event.shortTitle}</h3><p>{event.description}</p><div className="ev-facts"><span><Calendar size={14} aria-hidden="true" />{event.date}</span><span><MapPin size={14} aria-hidden="true" />{event.location}</span></div><div className="ev-tags">{event.tags.map(tag => <span key={tag}>{tag}</span>)}</div></div>
      <div className="ev-ticket-tear" aria-hidden="true"><span /><i /><span /></div>
      <div className="ev-ticket-bottom"><div><span className="ev-kicker">{status === 'Past' ? 'LISTED PRIZE POOL' : 'PRIZES WORTH'}</span><strong>₹{event.prizePool}<small>*</small></strong></div><button type="button" className="ev-open" onClick={() => onOpen(event)} aria-label={`View details for ${event.title}`}><ArrowUpRight aria-hidden="true" /></button></div>
      <button className="ev-ticket-link" type="button" onClick={() => onOpen(event)}>{status === 'Past' ? 'OPEN THE ARCHIVE' : 'GET THE FULL BRIEF'}<span aria-hidden="true">↗</span></button>
    </div>
  </motion.article>;
}

function EventDialog({ event, onClose, day }) {
  const dialog = useRef(null);
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
    <div className="ev-facts"><span><Calendar size={16} />{event.date}</span><span><MapPin size={16} />{event.location}</span></div><p>{event.description}</p><div className="ev-tags">{event.tags.map(tag => <span key={tag}>{tag}</span>)}</div>
    <div className="ev-dialog-prize"><span>LISTED PRIZE POOL</span><strong>₹{event.prizePool}*</strong></div><p className="ev-dialog-note">*Prize pool as listed. Event times and a registration link are not listed yet. A calendar download saves these dates only; it does not register you.</p>
    <div className="ev-dialog-actions"><button type="button" className="ev-button" onClick={() => downloadCalendar(event)}><Download size={16} />SAVE DATES (.ICS)</button><a className="ev-text-link" href="team.html">MEET THE SAC CREW <ArrowUpRight size={16} /></a></div>
  </dialog>;
}

function EventsPage() {
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
      <div className="ev-topline"><span><Radio size={13} />SAC / LIVE TRANSMISSIONS & ARCHIVES</span><span>LESS SPECTATING. MORE PARTICIPATING.</span></div>
      <div className="ev-hero-frame">
        <img className="ev-hero-image" src={bannerImage} alt="Neon robotics lab with glowing circuits and robotic arms." width="1024" height="1024" fetchPriority="high" />
        <div className="ev-hero-shade" /><div className="ev-scanlines" aria-hidden="true" />
        <div className="ev-orbit-sticker" aria-hidden="true"><span>MAKE SOME</span><Zap /><strong>NOISE.</strong></div>
        <div className="ev-hero-copy"><p className="ev-kicker"><i />YOUR NEXT GOOD STORY STARTS HERE.</p><h1 id="ev-title">EVENTS THAT<br />HIT <span>DIFFERENT.</span></h1><p>Hack it. Build it. Battle it out.<br />Bring your people. Leave with a story.</p><a className="ev-button" href="#event-board">FIND YOUR NEXT THING <ArrowDown size={18} /></a></div>
        <div className="ev-hero-side" aria-hidden="true">CURIOSITY / AT FULL VOLUME</div>
        <div className="ev-hero-coordinates" aria-hidden="true">SIGNAL: STRONG <span>///</span> ENERGY: UNREASONABLE</div>
      </div>
      <div className="ev-next-ticket"><div className="ev-next-icon"><Radio aria-hidden="true" /></div><div className="ev-next-copy"><span className="ev-kicker">{next ? 'NEXT ON THE RADAR' : 'THE RADAR IS QUIET'}</span><strong>{next ? next.title : 'More good things to come.'}</strong><span>{next ? `${next.date} / ${next.location}` : 'Explore the archive while we wait for the next transmission.'}</span></div>{next && <><div className="ev-countdown"><strong>{String(daysUntil(next, day)).padStart(2, '0')}</strong><span>{daysUntil(next, day) ? 'DAYS TO GO' : 'HAPPENING NOW'}</span></div><button type="button" className="ev-next-open" onClick={() => setSelected(next)} aria-label={`View next event: ${next.title}`}><ArrowUpRight /></button></>}</div>
    </section>
    <div className="ev-ticker" aria-hidden="true"><div>{[0, 1].map(n => <span key={n}>GOOD IDEAS. LOUD ENERGY. <b>✳</b> BUILD SOMETHING WORTH TALKING ABOUT. <b>✳</b>&nbsp;</span>)}</div></div>
    <section className="ev-board" id="event-board" aria-labelledby="ev-board-title">
      <div className="ev-board-heading"><div><span className="ev-kicker">01 / PICK YOUR FREQUENCY</span><h2 id="ev-board-title">THE EVENT<br /><span>PLAYGROUND.</span></h2></div><div className="ev-board-meta"><span><b>{String(events.length).padStart(2, '0')}</b> TRANSMISSIONS</span><span><b>{String(upcoming).padStart(2, '0')}</b> UPCOMING / LIVE</span><p>Different ways to get a little<br />out of your comfort zone.</p></div></div>
      <div className="ev-toolbar"><div className="ev-filters" role="group" aria-label="Filter events">{[['all', 'ALL SIGNALS', events.length], ['upcoming', 'UPCOMING', upcoming], ['past', 'THE ARCHIVE', events.length - upcoming]].map(([key, label, count]) => <button type="button" key={key} aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}<span>{count}</span></button>)}</div><label className="ev-search"><Search size={17} aria-hidden="true" /><span className="ev-sr-only">Search events by name, topic, or venue</span><input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Find your frequency…" /></label></div>
      <div className="ev-results" role="status">{visible.length} {visible.length === 1 ? 'event' : 'events'} on this frequency <span aria-hidden="true">↘</span></div>
      <div className="ev-ticket-grid">{visible.map(event => <EventCard key={event.id} event={event} onOpen={setSelected} paused={paused} day={day} />)}</div>
      {!visible.length && <div className="ev-empty"><Radio size={38} /><h3>NO SIGNAL. YET.</h3><p>Try another name, topic, or event filter.</p><button type="button" className="ev-button" onClick={() => { setFilter('all'); setQuery(''); }}>RESET THE FREQUENCY <Zap size={16} /></button></div>}
      <p className="ev-art-note">Promotional and concept artwork. Event details are shown as listed.</p>
    </section>
    <section className="ev-playbook"><div><span className="ev-kicker">02 / YOUR ONLY ASSIGNMENT</span><h2>SHOW UP.<br /><span>GEEK OUT.</span></h2><p>You don’t have to know everything.<br />You just have to be curious about something.</p></div><div className="ev-playbook-steps"><article><span>01</span><div><h3>Pick your rabbit hole.</h3><p>Code, circuits, or a robot with an attitude. Follow the thing that pulls you in.</p></div><Cpu aria-hidden="true" /></article><article><span>02</span><div><h3>Find your accomplices.</h3><p>Bring a friend, or meet someone who asks the same strange questions.</p></div><Radio aria-hidden="true" /></article><article><span>03</span><div><h3>Make a little noise.</h3><p>Try something. Share the messy version. Give someone else an idea.</p></div><Zap aria-hidden="true" /></article></div></section>
    <section className="ev-cta"><span className="ev-kicker">THE BEST PART IS WHO YOU MEET.</span><a href="join.html">COME FOR THE TECH.<br /><span>STAY FOR THE PEOPLE.</span><MoveUpRight aria-hidden="true" /></a><div className="ev-footer"><a href="index.html">SAC / SENSING & AUTOMATION CLUB</a><nav aria-label="Events footer navigation"><a href="projects.html">PROJECTS ↗</a><a href="team.html">THE CREW ↗</a></nav><span>© 2026 SAC</span></div></section>
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
