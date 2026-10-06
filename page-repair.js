import './page-repair.css';

const trigger = document.querySelector('[data-page-repair]');
const page = document.querySelector('.page-wrapper');
const motion = matchMedia('(prefers-reduced-motion: reduce)');
let active = null;
let modelModule;
// Warm the existing robot on intent, keeping Three.js out of the initial load.
const loadRobot = () => modelModule ||= import('./cursor-robot/model.js');
trigger?.addEventListener('pointerenter', () => { loadRobot().catch(() => {}); }, { once: true });
trigger?.addEventListener('focus', () => { loadRobot().catch(() => {}); }, { once: true });

// All audio is synthesized locally, and the context starts inside the click gesture.
function createSound() {
    let context;
    let muted = false;
    try {
        const Audio = window.AudioContext || window.webkitAudioContext;
        context = new Audio();
        void context.resume().catch(() => {});
    } catch { /* The visual story also works without audio support. */ }
    return {
        get available() { return Boolean(context); },
        setMuted(value) { muted = value; if (context) void (value ? context.suspend() : context.resume()).catch(() => {}); },
        play(kind) {
            if (!context || muted || context.state === 'closed') return;
            try {
                const t = context.currentTime;
                const noise = kind === 'break' || kind === 'weld';
                const duration = kind === 'break' ? .65 : kind === 'weld' ? .16 : .22;
                const gain = context.createGain();
                gain.gain.setValueAtTime(kind === 'break' ? .12 : .035, t);
                gain.gain.exponentialRampToValueAtTime(.001, t + duration);
                gain.connect(context.destination);
                let source;
                if (noise) {
                    const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
                    const data = buffer.getChannelData(0);
                    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (i % 700 < 500 ? 1 : .15);
                    source = context.createBufferSource();
                    source.buffer = buffer;
                    const filter = context.createBiquadFilter();
                    filter.type = 'bandpass';
                    filter.frequency.value = kind === 'break' ? 650 : 2300;
                    source.connect(filter);
                    filter.connect(gain);
                } else {
                    source = context.createOscillator();
                    source.type = 'sine';
                    source.frequency.setValueAtTime(kind === 'done' ? 660 : 280, t);
                    source.frequency.exponentialRampToValueAtTime(kind === 'done' ? 990 : 540, t + duration);
                    source.connect(gain);
                }
                source.start(t);
                source.stop(t + duration);
                source.onended = () => { source.disconnect(); gain.disconnect(); };
            } catch { /* Audio failures must never interrupt page restoration. */ }
        },
        close() { if (context && context.state !== 'closed') void context.close().catch(() => {}); },
    };
}

// Clone only the visible page sections. No live iframe, script, form, or duplicate
// IDs run in the fragments. The original DOM stays intact beneath the dialog.
function snapshotPage(width, height) {
    const rect = page.getBoundingClientRect();
    const copy = page.cloneNode(true);
    const originals = [...page.querySelectorAll('iframe, video, canvas')];
    const mediaSources = new Map([...copy.querySelectorAll('iframe, video, canvas')].map((node, i) => [node, originals[i]]));
    const children = [...page.children];
    [...copy.children].forEach((child, i) => {
        const box = children[i].getBoundingClientRect();
        if (box.bottom < 0 || box.top > height) {
            const spacer = document.createElement('div');
            spacer.style.cssText = `height:${box.height}px;flex:none`;
            child.replaceWith(spacer);
        }
    });
    copy.querySelectorAll('iframe, video, canvas').forEach(element => {
        const source = mediaSources.get(element);
        const still = document.createElement('img');
        still.style.cssText = element.style.cssText;
        still.className = element.className;
        still.style.objectFit = 'contain';
        still.alt = '';
        try {
            const video = source.tagName === 'IFRAME' ? source.contentDocument?.querySelector('video') : source;
            if (video && (video.videoWidth || video.width)) {
                const canvas = document.createElement('canvas');
                canvas.width = video.videoWidth || video.width;
                canvas.height = video.videoHeight || video.height;
                canvas.getContext('2d').drawImage(video, 0, 0);
                still.src = canvas.toDataURL();
            }
        } catch { /* A missing video frame is decorative, never blocking. */ }
        if (still.src) element.replaceWith(still);
        else element.remove();
    });
    copy.querySelectorAll('script, audio, source').forEach(element => element.remove());
    copy.querySelectorAll('[id]').forEach(element => element.removeAttribute('id'));
    copy.querySelectorAll('[autofocus]').forEach(element => element.removeAttribute('autofocus'));
    copy.classList.add('repair-snapshot');
    copy.inert = true;
    copy.setAttribute('aria-hidden', 'true');
    Object.assign(copy.style, {
        position: 'absolute', margin: '0', width: `${rect.width}px`, height: `${rect.height}px`,
        left: `${rect.left}px`, top: `${rect.top}px`, transform: 'none', opacity: '1', visibility: 'visible',
    });
    return copy;
}

function createShards(host, width, height, snapshot) {
    const columns = width < 700 ? 3 : 4;
    const rows = width < 700 ? 4 : 3;
    const vertices = Array.from({ length: rows + 1 }, (_, y) =>
        Array.from({ length: columns + 1 }, (_, x) => ({
            x: x * width / columns + (x && x < columns ? Math.sin(y * 4 + x * 7) * width / columns * .16 : 0),
            y: y * height / rows + (y && y < rows ? Math.cos(x * 4 + y * 7) * height / rows * .18 : 0),
        })));
    const shards = [];
    function jaggedEdge(a, b) {
        // Canonical edge direction gives both neighbouring shards the same notch.
        const [start, end] = a.x < b.x || (a.x === b.x && a.y < b.y) ? [a, b] : [b, a];
        const boundary = (a.x === b.x && (a.x === 0 || a.x === width)) || (a.y === b.y && (a.y === 0 || a.y === height));
        return { x: (a.x + b.x) / 2 + (boundary ? 0 : (end.y - start.y) * .075), y: (a.y + b.y) / 2 - (boundary ? 0 : (end.x - start.x) * .075) };
    }
    function addShard(corners, site) {
        const points = corners.flatMap((p, i) => [p, jaggedEdge(p, corners[(i + 1) % corners.length])]);
        const left = Math.min(...points.map(p => p.x));
        const top = Math.min(...points.map(p => p.y));
        const w = Math.max(...points.map(p => p.x)) - left;
        const h = Math.max(...points.map(p => p.y)) - top;
        const element = document.createElement('div');
        element.className = 'repair-shard';
        Object.assign(element.style, {
            left: `${left}px`, top: `${top}px`, width: `${w}px`, height: `${h}px`,
            clipPath: `polygon(${points.map(p => `${p.x - left}px ${p.y - top}px`).join(',')})`,
        });
        const copy = snapshot.cloneNode(true);
        copy.style.left = `${parseFloat(snapshot.style.left) - left}px`;
        copy.style.top = `${parseFloat(snapshot.style.top) - top}px`;
        element.append(copy);
        host.append(element);
        const i = shards.length;
        const cx = left + w / 2, cy = top + h / 2;
        shards.push({ element, x: cx, y: cy, points, site,
            burst: `translate(${(cx - width / 2) * .25}px, ${-65 - i % 4 * 20}px) rotate(${(i % 2 ? 1 : -1) * 12}deg) scale(.94)`,
            fallen: `translate(${(width * (.09 + .82 * ((i * 7 % 24) / 23))) - cx}px, ${height * (.63 + (i % 4) * .055) - cy}px) rotate(${(i % 2 ? 1 : -1) * (18 + i * 6)}deg) scale(.55)` });
    }
    for (let y = 0; y < rows; y++) for (let step = 0; step < columns; step++) {
        // A serpentine route avoids making the engineer cross the whole screen.
        const x = y % 2 ? columns - step - 1 : step;
        const [a, b, c, d] = [vertices[y][x], vertices[y][x + 1], vertices[y + 1][x + 1], vertices[y + 1][x]];
        const site = { x: (a.x + b.x + c.x + d.x) / 4, y: (a.y + b.y + c.y + d.y) / 4 };
        if ((x + y) % 2) { addShard([a, b, d], site); addShard([b, c, d], site); }
        else { addShard([a, b, c], site); addShard([a, c, d], site); }
    }
    return shards;
}

const fallbackRobot = `<svg class="repair-fallback" viewBox="0 0 200 200" aria-hidden="true"><g stroke="#53616a" stroke-width="3"><path d="M78 145v30h17v-30m13 0v30h17v-30" fill="#e9eeea"/><rect x="69" y="106" width="62" height="48" rx="14" fill="#e9eeea"/><path d="M65 116l-12 30m81-30 28-24" stroke="#e9eeea" stroke-width="14"/><path d="m163 93 12-17" stroke="#e58b28" stroke-width="9"/><rect x="44" y="34" width="112" height="78" rx="23" fill="#e9eeea"/><rect x="50" y="40" width="100" height="65" rx="20" fill="#e58b28"/><rect x="58" y="47" width="84" height="50" rx="15" fill="#101f28"/></g><g fill="#eaffff"><ellipse cx="80" cy="72" rx="9" ry="11"/><ellipse cx="120" cy="72" rx="9" ry="11"/></g><circle cx="115" cy="123" r="5" fill="#e58b28"/></svg>`;

trigger?.addEventListener('click', async () => {
    if (active || !page) return;
    const controller = new AbortController();
    const { signal } = controller;
    const sound = createSound();
    const reduced = motion.matches;
    const width = innerWidth, height = innerHeight;
    const size = height < 550 ? 110 : width < 700 ? 140 : 190;
    const scroll = { x: scrollX, y: scrollY };
    const overflow = document.documentElement.style.overflow;
    const dialog = document.createElement('dialog');
    dialog.className = 'repair-stage';
    dialog.dataset.phase = 'breaking';
    dialog.setAttribute('aria-labelledby', 'repair-title');
    dialog.style.setProperty('--robot-size', `${size}px`);
    dialog.innerHTML = `<svg class="repair-blueprints" aria-hidden="true"></svg><div class="repair-shards" aria-hidden="true"></div>
        <div class="repair-heading"><span class="repair-eyebrow">SAC / ACCIDENTAL DEMOLITION</span><h2 id="repair-title">Oops, you made a mistake.</h2><p>That was a load-bearing X. Calling our smallest engineer.</p></div>
        <svg class="repair-effects" aria-hidden="true"><path class="repair-seam" pathLength="100" visibility="hidden"/><g class="repair-reticle" visibility="hidden"><circle r="20"/><path d="M-28 0H-12M12 0H28M0-28V-12M0 12V28"/><text y="-34" text-anchor="middle"></text></g><line class="repair-beam" visibility="hidden"/><g class="repair-sparks" visibility="hidden"><circle r="5" fill="#fff4c8"/>${Array.from({ length: 13 }, (_, i) => `<line transform="rotate(${i * 360 / 13})" x1="${8 + i % 3 * 3}" x2="${20 + i % 4 * 7}"/>`).join('')}</g></svg>
        <div class="repair-robo" aria-label="SAC robot repairing the page">${fallbackRobot}<canvas aria-hidden="true"></canvas><div class="repair-thought" role="status"><small>SAC BOT / THINKING</small><span>Okay… who touched the X?</span></div></div>
        <div class="repair-footer"><div class="repair-chapters" aria-label="Repair stages"><span data-current="true">01 / SURVEY</span><span>02 / RECOVER</span><span>03 / WELD</span><span>04 / VERIFY</span></div><div class="repair-status"><span class="repair-task" role="status">DAMAGE DETECTED</span><span class="repair-count">00 / 24 FIXED</span></div><div class="repair-progress" role="progressbar" aria-label="Page repair" aria-valuemin="0" aria-valuemax="24" aria-valuenow="0"><span></span></div><div class="repair-controls"><button type="button" class="repair-mute" aria-pressed="false">Sound: on</button><span>24 FRAGMENTS · 12 REPAIR SITES</span><button type="button" class="repair-skip" autofocus>Skip & restore ↗</button></div></div>`;
    let frame = 0;
    let model;
    let closed = false;
    const animations = new Set();
    function finish() {
        if (closed) return;
        closed = true;
        controller.abort();
        cancelAnimationFrame(frame);
        animations.forEach(animation => animation.cancel());
        model?.dispose();
        sound.close();
        document.body.classList.remove('page-is-repairing');
        document.documentElement.style.overflow = overflow;
        dialog.close();
        dialog.remove();
        window.scrollTo(scroll.x, scroll.y);
        trigger.focus({ preventScroll: true });
        active = null;
    }
    active = finish;
    const pause = ms => new Promise((resolve, reject) => {
        const abort = () => { clearTimeout(timer); reject(new DOMException('Repair cancelled', 'AbortError')); };
        const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, ms);
        if (signal.aborted) abort();
        else signal.addEventListener('abort', abort, { once: true });
    });
    async function animate(element, keyframes, duration, delay = 0) {
        signal.throwIfAborted();
        const animation = element.animate(keyframes, { duration: reduced ? 100 : duration, delay: reduced ? 0 : delay, easing: 'cubic-bezier(.22,.7,.24,1)', fill: 'forwards' });
        animations.add(animation);
        try { await animation.finished; } finally { animations.delete(animation); }
        signal.throwIfAborted();
        Object.assign(element.style, keyframes[keyframes.length - 1]);
        animation.cancel();
    }
    try {
        const snapshot = snapshotPage(width, height);
        const shards = createShards(dialog.querySelector('.repair-shards'), width, height, snapshot);
        const robot = dialog.querySelector('.repair-robo');
        const thought = dialog.querySelector('.repair-thought span');
        const task = dialog.querySelector('.repair-task');
        const beam = dialog.querySelector('.repair-beam');
        const sparks = dialog.querySelector('.repair-sparks');
        const progress = dialog.querySelector('.repair-progress');
        const seam = dialog.querySelector('.repair-seam');
        const reticle = dialog.querySelector('.repair-reticle');
        const chapters = [...dialog.querySelectorAll('.repair-chapters span')];
        const chapter = index => chapters.forEach((element, i) => { element.dataset.current = String(i === index); });
        const pathFor = points => `M${points.map(p => `${p.x},${p.y}`).join('L')}Z`;
        const blueprints = dialog.querySelector('.repair-blueprints');
        shards.forEach(shard => {
            const outline = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            outline.setAttribute('d', pathFor(shard.points));
            blueprints.append(outline);
            shard.outline = outline;
        });
        const body = { x: 0, y: 0, vx: 0, grounded: true, crash: 0, repair: false };
        let position = { x: -size * 2, y: height - size - 130 };
        let weldPoint = null;
        let welding = null;
        let lastSparkSound = 0;
        robot.style.transform = `translate(${position.x}px, ${position.y}px)`;
        document.body.append(dialog);
        dialog.showModal();
        document.documentElement.style.overflow = 'hidden';
        document.body.classList.add('page-is-repairing');
        dialog.querySelector('.repair-skip').addEventListener('click', finish, { signal });
        dialog.addEventListener('cancel', event => { event.preventDefault(); finish(); }, { signal });
        window.addEventListener('resize', finish, { signal });
        window.addEventListener('pagehide', finish, { signal });
        motion.addEventListener('change', finish, { signal });
        const mute = dialog.querySelector('.repair-mute');
        if (!sound.available) { mute.textContent = 'Sound unavailable'; mute.disabled = true; }
        mute.addEventListener('click', () => {
            const muted = mute.getAttribute('aria-pressed') !== 'true';
            mute.setAttribute('aria-pressed', String(muted));
            mute.textContent = muted ? 'Sound: off' : 'Sound: on';
            sound.setMuted(muted);
        }, { signal });
        void loadRobot().then(({ createRobot }) => {
            if (closed) return;
            try {
                model = createRobot(robot.querySelector('canvas'), size);
                robot.querySelector('.repair-fallback').setAttribute('hidden', '');
                robot.querySelector('canvas').addEventListener('webglcontextlost', () => {
                    model?.dispose();
                    model = null;
                    robot.querySelector('.repair-fallback').removeAttribute('hidden');
                }, { signal });
            } catch { /* Keep the matching flat robot when WebGL is unavailable. */ }
        }).catch(() => {});
        let previous = 0;
        function tick(now) {
            if (closed) return;
            const dt = previous ? Math.min((now - previous) / 1000, .05) : .016;
            previous = now;
            model?.render(body, { x: body.x + 50, y: body.y - 100 }, reduced ? 0 : dt, reduced ? 0 : now / 1000);
            if (weldPoint && !reduced) {
                if (welding) {
                    const fraction = Math.min(1, (now - welding.start) / welding.duration);
                    const point = seam.getPointAtLength(welding.length * fraction);
                    weldPoint = { x: point.x, y: point.y };
                    seam.style.strokeDashoffset = String(100 * (1 - fraction));
                    beam.setAttribute('x2', String(point.x));
                    beam.setAttribute('y2', String(point.y));
                    if (now - lastSparkSound > 190) { sound.play('weld'); lastSparkSound = now; }
                }
                sparks.setAttribute('transform', `translate(${weldPoint.x} ${weldPoint.y}) rotate(${now * .18}) scale(${.7 + Math.sin(now * .022) * .25})`);
            }
            frame = requestAnimationFrame(tick);
        }
        frame = requestAnimationFrame(tick);
        sound.play('break');
        await Promise.all(shards.map((shard, i) => {
            shard.element.dataset.fixed = 'false';
            return animate(shard.element, reduced ? [{ transform: 'none' }, { transform: 'scale(.96)' }] : [{ transform: 'none' }, { transform: shard.burst, offset: .23 }, { transform: shard.fallen }], 1650, i * 14);
        }));
        dialog.dataset.phase = 'assessment';
        task.textContent = 'SCANNING 24 FRACTURES…';
        await pause(reduced ? 650 : 1900);
        async function moveRobot(x, y) {
            const leftSide = x + size / 2 > width / 2;
            robot.dataset.side = leftSide ? 'left' : 'right';
            const bubble = robot.querySelector('.repair-thought');
            const bubbleWidth = width < 700 ? 180 : 238;
            const desired = leftSide ? x + size * .2 - bubbleWidth : x + size * .8;
            bubble.style.left = `${Math.max(12, Math.min(width - bubbleWidth - 12, desired)) - x}px`;
            bubble.style.right = 'auto';
            body.vx = 170;
            const next = { x, y };
            robot.dataset.moving = 'true';
            await animate(robot, [{ transform: `translate(${position.x}px, ${position.y}px)` }, { transform: `translate(${x}px, ${y}px)` }], 850);
            position = next;
            body.vx = 0;
            robot.dataset.moving = 'false';
        }
        await moveRobot(width * .5 - size / 2, Math.max(230, height * .56 - size / 2));
        await pause(reduced ? 500 : 1700);
        dialog.dataset.phase = 'repairing';
        dialog.querySelector('#repair-title').textContent = 'Rebuilding, piece by piece.';
        dialog.querySelector('.repair-heading p').textContent = 'Recover. Align. Weld. Repeat. Our engineer has a plan.';
        const thoughts = [
            'Found the problem. The whole website is on the floor.',
            'Hold still. I have a tiny welder and a very big plan.',
            'A few loose pixels… nothing a little spark can’t fix.',
            'Reconnecting the clever bits. Yes, that includes the buttons.',
            'Looking good! Just tightening the last few corners.',
            'One final weld. Maybe admire the X from a distance next time?',
        ];
        const tasks = ['RECOVERING THE HEADER', 'ALIGNING THE FRAME', 'WELDING THE PIXELS', 'RECONNECTING CIRCUITS', 'SECURING THE CORNERS', 'CHECKING EVERY CONNECTION'];
        // Visit each work site, fit its two fragments separately, then trace the
        // seam with the torch. A completed site is locked before moving onward.
        for (let batch = 0; batch < 12; batch++) {
            const pair = shards.slice(batch * 2, batch * 2 + 2);
            const target = pair[0].site;
            thought.textContent = thoughts[Math.floor(batch / 2)];
            const siteLabel = `SITE ${String(batch + 1).padStart(2, '0')} / 12`;
            task.textContent = `${siteLabel} · RECOVERING`;
            chapter(1);
            dialog.dataset.action = 'travelling';
            reticle.setAttribute('transform', `translate(${target.x} ${target.y})`);
            reticle.setAttribute('visibility', 'visible');
            reticle.querySelector('text').textContent = siteLabel;
            const x = Math.max(12, Math.min(width - size - 12, target.x - size * .89));
            const y = Math.max(height < 550 ? 150 : 215, Math.min(height - size - 155, target.y - size * .37));
            await moveRobot(x, y);
            dialog.dataset.action = 'aligning';
            for (const shard of pair) {
                shard.element.classList.add('is-aligning');
                await animate(shard.element, [
                    { transform: shard.element.style.transform },
                    { transform: 'translate(0, -14px) rotate(2deg) scale(.96)', offset: .7 },
                    { transform: 'none' },
                ], 850);
                shard.element.classList.remove('is-aligning');
                sound.play('snap');
            }
            chapter(2);
            dialog.dataset.action = 'welding';
            task.textContent = `${siteLabel} · ${tasks[Math.floor(batch / 2)]}`;
            body.repair = true;
            seam.setAttribute('d', pathFor(pair[0].points));
            seam.style.strokeDasharray = '100';
            seam.style.strokeDashoffset = '100';
            seam.setAttribute('visibility', 'visible');
            weldPoint = pair[0].points[0];
            welding = { start: performance.now(), duration: 1550, length: seam.getTotalLength() };
            beam.setAttribute('x1', String(x + size * .89));
            beam.setAttribute('y1', String(y + size * .37));
            beam.setAttribute('x2', String(target.x));
            beam.setAttribute('y2', String(target.y));
            beam.setAttribute('visibility', 'visible');
            sparks.setAttribute('transform', `translate(${target.x} ${target.y})`);
            sparks.setAttribute('visibility', 'visible');
            pair.forEach(shard => shard.element.classList.add('is-welding'));
            sound.play('weld');
            await pause(reduced ? 650 : 1650);
            welding = null;
            seam.style.strokeDashoffset = '0';
            pair.forEach(shard => {
                shard.element.classList.remove('is-welding');
                shard.element.dataset.fixed = 'true';
                shard.outline.style.opacity = '0';
            });
            body.repair = false;
            weldPoint = null;
            beam.setAttribute('visibility', 'hidden');
            sparks.setAttribute('visibility', 'hidden');
            reticle.setAttribute('visibility', 'hidden');
            seam.setAttribute('visibility', 'hidden');
            const count = (batch + 1) * 2;
            progress.setAttribute('aria-valuenow', String(count));
            progress.firstElementChild.style.width = `${count / shards.length * 100}%`;
            dialog.querySelector('.repair-count').textContent = `${String(count).padStart(2, '0')} / 24 FIXED`;
            sound.play('snap');
            await pause(reduced ? 80 : 200);
        }
        chapter(3);
        dialog.dataset.action = 'verifying';
        task.textContent = 'VERIFYING ALL 12 CONNECTIONS';
        thought.textContent = 'Everything is connected. Let me check my work…';
        await moveRobot(width * .5 - size / 2, Math.max(215, height - size - 165));
        await pause(reduced ? 700 : 2200);
        dialog.dataset.phase = 'complete';
        dialog.querySelector('#repair-title').textContent = 'All fixed. We’re back.';
        dialog.querySelector('.repair-heading p').textContent = 'A little curiosity never broke anything. Permanently.';
        dialog.querySelector('.repair-eyebrow').textContent = 'SAC / SYSTEM RESTORED';
        thought.textContent = 'Good as new. My invoice? One less click on that X.';
        task.textContent = 'ALL SYSTEMS BACK ONLINE';
        sound.play('done');
        await pause(reduced ? 800 : 2300);
        document.body.classList.remove('page-is-repairing');
        window.dispatchEvent(new CustomEvent('sac:repair-complete', { detail: { x: position.x + size / 2, y: position.y + size / 2 } }));
        await animate(dialog, [{ opacity: '1' }, { opacity: '0' }], 450);
    } catch (error) {
        if (error.name !== 'AbortError') console.warn('Page repair restored safely:', error);
    } finally { finish(); }
});

if (import.meta.hot) import.meta.hot.dispose(() => active?.());
