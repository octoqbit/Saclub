const body = document.body;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const motionButton = document.querySelector('.motion-toggle');
let motionPaused = reducedMotion.matches;
function setMotion(paused) {
    motionPaused = paused;
    body.classList.toggle('motion-paused', paused);
    motionButton.setAttribute('aria-pressed', String(paused));
    motionButton.textContent = paused ? '▶ RESUME MOTION' : 'Ⅱ PAUSE MOTION';
    if (paused) document.querySelectorAll('[data-parallax]').forEach(el => {
        el.style.removeProperty('--rx'); el.style.removeProperty('--ry');
    });
}
motionButton.addEventListener('click', () => setMotion(!motionPaused));
reducedMotion.addEventListener('change', () => setMotion(reducedMotion.matches));
setMotion(motionPaused);

const menu = document.querySelector('.world-menu');
const nav = document.querySelector('#world-links');
function setMenu(open) {
    menu.setAttribute('aria-expanded', String(open));
    menu.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
    menu.textContent = open ? '×' : '☰';
    nav.classList.toggle('menu-open', open);
}
menu.addEventListener('click', () => setMenu(menu.getAttribute('aria-expanded') !== 'true'));
nav.addEventListener('click', e => { if (e.target.closest('a')) setMenu(false); });
document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && menu.getAttribute('aria-expanded') === 'true') { setMenu(false); menu.focus(); }
});

const reveals = [...document.querySelectorAll('[data-reveal]')];
if ('IntersectionObserver' in window) {
    body.classList.add('reveal-ready');
    const revealObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add('revealed');
            revealObserver.unobserve(entry.target);
        });
    }, { threshold: .08 });
    reveals.forEach(el => revealObserver.observe(el));
    // Keyboard users must never focus an invisible card.
    document.addEventListener('focusin', e => e.target.closest('[data-reveal]')?.classList.add('revealed'));
}
let scrollFrame = 0;
function updateProgress() {
    const available = document.documentElement.scrollHeight - innerHeight;
    const progress = available > 0 ? Math.min(1, Math.max(0, scrollY / available)) : 0;
    document.querySelector('.scroll-progress').style.transform = `scaleX(${progress})`;
    scrollFrame = 0;
}
addEventListener('scroll', () => { if (!scrollFrame) scrollFrame = requestAnimationFrame(updateProgress); }, { passive: true });
addEventListener('resize', updateProgress);
updateProgress();
const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
document.querySelectorAll('[data-parallax]').forEach(el => {
    el.addEventListener('pointermove', e => {
        if (motionPaused || reducedMotion.matches || !finePointer.matches) return;
        const box = el.getBoundingClientRect();
        const x = (e.clientX - box.left) / box.width - .5;
        const y = (e.clientY - box.top) / box.height - .5;
        el.style.setProperty('--rx', `${x * 7}deg`);
        el.style.setProperty('--ry', `${-y * 7}deg`);
    });
    el.addEventListener('pointerleave', () => { el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg'); });
});

const filters = [...document.querySelectorAll('[data-filter]')];
const projects = [...document.querySelectorAll('[data-category]')];
filters.forEach(button => button.addEventListener('click', () => {
    filters.forEach(filter => filter.setAttribute('aria-pressed', String(filter === button)));
    let shown = 0;
    projects.forEach(card => {
        card.hidden = button.dataset.filter !== 'all' && button.dataset.filter !== card.dataset.category;
        if (!card.hidden) { shown++; card.classList.add('revealed'); }
    });
    document.querySelector('.filter-count').textContent = `${shown} concept${shown === 1 ? '' : 's'}`;
    updateProgress();
}));

const details = {
    rover: { kicker: 'EXP—01 / ROBOTICS CONCEPT', title: 'ATLAS / ROVER', description: 'What if a small rover could explore an unfamiliar space and find its own way back?', tags: ['Navigation', 'Sensors', 'Embedded control'], subtitle: 'The first experiment', text: 'Start with a wheeled platform and a distance sensor. Read the surroundings, stop before an obstacle, then add a simple navigation loop. This is a concept study, not a completed SAC project.' },
    vision: { kicker: 'EXP—02 / AI CONCEPT', title: 'IRIS / VISION', description: 'A camera sees pixels. A useful system finds a pattern that means something.', tags: ['Computer vision', 'Python', 'Edge AI'], subtitle: 'The first experiment', text: 'Choose a small set of everyday objects and explore how a model distinguishes them. Test changing light, angles, and backgrounds before connecting the output to a real-world action. This is a concept study.' },
    signal: { kicker: 'EXP—03 / IoT CONCEPT', title: 'PULSE / NETWORK', description: 'Imagine a room that can tell you how it feels: warmer, brighter, quieter, or busier.', tags: ['Sensors', 'Wireless communication', 'Dashboards'], subtitle: 'The first experiment', text: 'Connect one environmental sensor to a microcontroller and display its readings. Then explore multiple nodes, missing readings, and a dashboard that makes the patterns clear. This is a concept study.' },
    arm: { kicker: 'EXP—04 / ROBOTICS CONCEPT', title: 'DEXTER / ARM', description: 'A simple pick-and-place task becomes a playground for mechanisms, geometry, and control.', tags: ['Mechanisms', 'Servo control', 'Kinematics'], subtitle: 'The first experiment', text: 'Model a small arm and explore one controlled joint at a time. Begin with a simulation, define movement limits, and work toward repeatable motion with a lightweight prototype. This is a concept study.' },
    hardware: { kicker: 'CREW MAP / HARDWARE & ROBOTICS', title: 'THE BUILDERS', description: 'For the people who want to take it apart, understand it, and put it back together differently.', tags: ['Electronics', 'Mechanisms', 'Prototyping'], subtitle: 'Find your starting point', text: 'Explore circuits, sensors, mechanical assemblies, and the patient work of testing a prototype. A first breadboard experiment is as welcome as an ambitious machine.' },
    code: { kicker: 'CREW MAP / SOFTWARE & AI', title: 'THE THINKERS', description: 'Turning a question into a program, then making the program do something useful.', tags: ['Software', 'AI', 'Embedded systems'], subtitle: 'Find your starting point', text: 'Build the logic that connects inputs to actions. Try a small script, a microcontroller program, or an experiment with data. Bring your questions and your willingness to debug.' },
    design: { kicker: 'CREW MAP / DESIGN & EXPERIENCE', title: 'THE SHAPERS', description: 'Making things understandable, useful, and a little more delightful.', tags: ['Product thinking', 'Interfaces', 'Visual design'], subtitle: 'Find your starting point', text: 'Sketch an interface, rethink a physical interaction, or help someone explain an idea visually. Design connects what a system can do with what a person needs.' },
    community: { kicker: 'CREW MAP / COMMUNITY & EVENTS', title: 'THE CONNECTORS', description: 'Bringing people into the same room—and giving them a reason to build together.', tags: ['Events', 'Collaboration', 'Communication'], subtitle: 'Find your starting point', text: 'Help shape workshops, coordinate a small challenge, or welcome someone to their first club session. Good communication is part of making good things.' },
    story: { kicker: 'CREW MAP / MEDIA & STORYTELLING', title: 'THE STORYTELLERS', description: 'The rough sketch, the breakthrough, the funny failure: all worth capturing.', tags: ['Photography', 'Video', 'Writing'], subtitle: 'Find your starting point', text: 'Document an experiment, make a short video, or explain a build in a way that invites someone else to try it. The process deserves to be seen, not just the finished result.' }
};
const dialog = document.querySelector('.detail-dialog');
let opener;
document.querySelectorAll('[data-detail]').forEach(button => button.addEventListener('click', () => {
    const detail = details[button.dataset.detail];
    if (!detail) return;
    opener = button;
    document.querySelector('#detail-kicker').textContent = detail.kicker;
    document.querySelector('#detail-title').textContent = detail.title;
    document.querySelector('#detail-description').textContent = detail.description;
    document.querySelector('#detail-subtitle').textContent = detail.subtitle;
    document.querySelector('#detail-body').textContent = detail.text;
    const tags = document.querySelector('#detail-tags');
    tags.replaceChildren(...detail.tags.map(text => { const tag = document.createElement('span'); tag.textContent = text; return tag; }));
    dialog.showModal(); body.classList.add('has-dialog');
}));
dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', e => {
    if (e.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    if (e.clientX < box.left || e.clientX > box.right || e.clientY < box.top || e.clientY > box.bottom) dialog.close();
});
dialog.addEventListener('close', () => { body.classList.remove('has-dialog'); opener?.focus(); });
