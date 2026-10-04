import './robot.css';
import { RobotPhysics, SIZE, HALF } from './physics.mjs';

// Load the 3D renderer only on large screens with a real cursor. Mobile layouts
// and reduced-motion users do not download or run the WebGL animation.
const desktop = matchMedia('(min-width: 901px) and (hover: hover) and (pointer: fine)');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const obstacleSelector = [
    '.navbar', '.bg-marquee-container', '.partners-row',
    '.s2-top-banner', '.s3-top-banner', '.s4-top-banner', '.s5-top-banner',
    '.join-header-banner', '.join-form', '.site-footer', '.btn-orange',
    '.cursor-robo-toggle', '[data-robot-obstacle]',
].join(',');
let cleanup = null;
let loading = false;
let generation = 0;
let hasPointer = false;
let unavailable = false;
const lifecycle = new AbortController();
const pointer = { x: innerWidth * 0.7, y: innerHeight * 0.65, active: false };

async function sync() {
    if (!desktop.matches || reducedMotion.matches) {
        generation++;
        cleanup?.();
        cleanup = null;
        return;
    }
    if (!hasPointer || cleanup || loading || unavailable) return;
    loading = true;
    const version = generation;
    try {
        const { createRobot } = await import('./model.js');
        if (version !== generation || !desktop.matches || reducedMotion.matches) return;
        cleanup = mount(createRobot);
    } catch (error) {
        // Unsupported WebGL must not interfere with the website itself.
        unavailable = true;
        console.warn('Cursor robot unavailable:', error.message);
    } finally {
        loading = false;
    }
}

function mount(createRobot) {
    const host = document.createElement('div');
    host.className = 'cursor-robo';
    host.setAttribute('aria-hidden', 'true');
    host.hidden = true;
    const canvas = document.createElement('canvas');
    host.append(canvas);
    const model = createRobot(canvas, SIZE);
    const toggle = document.createElement('button');
    toggle.className = 'cursor-robo-toggle';
    toggle.type = 'button';
    toggle.title = 'Pause or resume the cursor robot (Esc to pause)';
    document.body.append(host, toggle);
    const body = new RobotPhysics();
    body.x = Math.max(HALF + 6, innerWidth - SIZE - 36);
    body.y = innerHeight - HALF - 70;
    let enabled = true;
    try { enabled = sessionStorage.getItem('sac-cursor-robot') !== 'paused'; } catch { /* Storage is optional. */ }
    let dirty = true;
    let elements = [];
    let frame = 0;
    let previousTime = 0;
    let elapsed = 0;
    const events = new AbortController();
    const { signal } = events;
    const markDirty = () => { dirty = true; };
    const resizeObserver = new ResizeObserver(markDirty);

    function collect() {
        elements = [...document.querySelectorAll(obstacleSelector)];
        resizeObserver.disconnect();
        resizeObserver.observe(document.querySelector('.page-wrapper') || document.body);
        elements.forEach(element => resizeObserver.observe(element));
        dirty = true;
    }

    function updateWorld() {
        const boxes = elements.flatMap(element => {
            const rect = element.getBoundingClientRect();
            if (!rect.width || !rect.height || rect.bottom < 0 || rect.top > innerHeight) return [];
            return [{ left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom }];
        });
        body.setWorld(innerWidth, innerHeight, boxes);
        dirty = false;
    }

    function tick(now) {
        frame = 0;
        if (!enabled || document.hidden) return;
        const dt = previousTime ? Math.min((now - previousTime) / 1000, 0.05) : 1 / 60;
        previousTime = now;
        elapsed += dt;
        if (dirty) updateWorld();
        const target = pointer.active ? pointer : { x: body.x, y: body.y, active: false };
        body.step(dt, target);
        host.hidden = !body.visible;
        if (body.visible) {
            host.style.transform = `translate3d(${body.x - HALF}px, ${body.y - HALF}px, 0)`;
            host.dataset.state = body.crash ? 'tumbling' : !body.grounded ? 'falling' : Math.abs(body.vx) > 15 ? 'running' : 'idle';
            model.render(body, target, dt, elapsed);
        }
        frame = requestAnimationFrame(tick);
    }

    function schedule() {
        if (frame) cancelAnimationFrame(frame);
        frame = 0;
        previousTime = 0;
        dirty = true;
        host.hidden = true;
        if (enabled && !document.hidden) frame = requestAnimationFrame(tick);
    }

    function setEnabled(value) {
        enabled = value;
        toggle.textContent = enabled ? 'Pause robot' : 'Resume robot';
        toggle.setAttribute('aria-pressed', String(enabled));
        try { sessionStorage.setItem('sac-cursor-robot', enabled ? 'active' : 'paused'); } catch { /* Optional. */ }
        schedule();
    }

    toggle.addEventListener('click', () => setEnabled(!enabled), { signal });
    window.addEventListener('keydown', event => {
        if (event.key === 'Escape' && enabled) setEnabled(false);
    }, { signal });
    window.addEventListener('scroll', markDirty, { passive: true, capture: true, signal });
    window.addEventListener('resize', markDirty, { passive: true, signal });
    document.addEventListener('visibilitychange', schedule, { signal });
    const onContextLost = event => {
        event.preventDefault();
        setEnabled(false);
        toggle.hidden = true;
    };
    canvas.addEventListener('webglcontextlost', onContextLost, { signal });
    collect();
    setEnabled(enabled);
    return () => {
        cancelAnimationFrame(frame);
        events.abort();
        resizeObserver.disconnect();
        model.dispose();
        host.remove();
        toggle.remove();
    };
}

window.addEventListener('pointermove', event => {
    if (event.pointerType !== 'mouse') return;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.active = true;
    hasPointer = true;
    void sync();
}, { passive: true, signal: lifecycle.signal });
document.documentElement.addEventListener('pointerleave', () => { pointer.active = false; }, { signal: lifecycle.signal });
window.addEventListener('blur', () => { pointer.active = false; }, { signal: lifecycle.signal });
desktop.addEventListener('change', sync, { signal: lifecycle.signal });
reducedMotion.addEventListener('change', sync, { signal: lifecycle.signal });

if (import.meta.hot) import.meta.hot.dispose(() => {
    generation++;
    lifecycle.abort();
    cleanup?.();
});
