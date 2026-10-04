const menuButton = document.getElementById('mobile-menu-btn');
const menu = document.getElementById('mobile-nav-links');
const mobile = matchMedia('(max-width: 900px)');
function closeMenu() {
    menu.classList.remove('menu-open');
    menuButton.classList.remove('active');
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.setAttribute('aria-label', 'Open navigation');
}
menuButton.addEventListener('click', () => {
    const open = menu.classList.toggle('menu-open');
    menuButton.classList.toggle('active', open);
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
});
menu.addEventListener('click', event => { if (event.target.closest('a')) closeMenu(); });
document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && menu.classList.contains('menu-open')) { closeMenu(); menuButton.focus(); }
});
mobile.addEventListener('change', closeMenu);

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const motionToggle = document.getElementById('ab-motion-toggle');
let paused = reducedMotion.matches;
function setMotion(value) {
    paused = value;
    document.body.classList.toggle('ab-motion-paused', paused);
    motionToggle.setAttribute('aria-pressed', String(paused));
    motionToggle.setAttribute('aria-label', paused ? 'Resume page animations' : 'Pause page animations');
    motionToggle.disabled = reducedMotion.matches;
    motionToggle.title = reducedMotion.matches ? 'Reduced motion is enabled in your device settings' : '';
    motionToggle.firstElementChild.textContent = paused ? '▷' : 'Ⅱ';
}
setMotion(paused);
motionToggle.addEventListener('click', () => setMotion(!paused));
reducedMotion.addEventListener('change', () => setMotion(reducedMotion.matches));

// Content remains visible without JavaScript or when motion is reduced.
if ('IntersectionObserver' in window && !reducedMotion.matches) {
    document.body.classList.add('ab-reveal-ready');
    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); }
        });
    }, { threshold: 0.08 });
    document.querySelectorAll('[data-reveal]').forEach(element => observer.observe(element));
}

const tilt = document.querySelector('[data-tilt]');
tilt.addEventListener('pointermove', event => {
    if (reducedMotion.matches || paused || event.pointerType !== 'mouse') return;
    const rect = tilt.getBoundingClientRect();
    tilt.style.setProperty('--tilt-x', `${((event.clientY - rect.top) / rect.height - 0.5) * -5}deg`);
    tilt.style.setProperty('--tilt-y', `${((event.clientX - rect.left) / rect.width - 0.5) * 5}deg`);
});
tilt.addEventListener('pointerleave', () => {
    tilt.style.removeProperty('--tilt-x');
    tilt.style.removeProperty('--tilt-y');
});

const tabs = [...document.querySelectorAll('[role="tab"]')];
function activateTab(tab) {
    tabs.forEach(button => {
        const active = button === tab;
        button.setAttribute('aria-selected', String(active));
        button.tabIndex = active ? 0 : -1;
        document.getElementById(button.getAttribute('aria-controls')).hidden = !active;
    });
}
tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => activateTab(tab));
    tab.addEventListener('keydown', event => {
        let next;
        if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
        if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
        if (event.key === 'Home') next = 0;
        if (event.key === 'End') next = tabs.length - 1;
        if (next === undefined) return;
        event.preventDefault();
        activateTab(tabs[next]);
        tabs[next].focus();
    });
});
