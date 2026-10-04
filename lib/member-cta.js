import { configured, currentProfile, supabase } from './supabase.js';

const cacheKey = 'sac-approved-member';

function setAccountCta() {
    document.querySelectorAll('[data-member-cta]').forEach((button) => {
        button.href = '/account';
        button.dataset.original = 'ACCOUNT';
        const label = button.querySelector('[data-cta-label]') || button;
        label.textContent = 'ACCOUNT';
    });
}

function clearAccountCache() {
    localStorage.removeItem(cacheKey);
}

export function initializeMemberCta() {
    const buttons = document.querySelectorAll('[data-member-cta]');
    if (!buttons.length || !configured || !supabase) return;

    supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session?.user) {
            clearAccountCache();
            return;
        }

        let cached = null;
        try {
            cached = JSON.parse(localStorage.getItem(cacheKey) || 'null');
        } catch {
            clearAccountCache();
        }
        if (cached?.userId === session.user.id && cached.approved) setAccountCta();

        currentProfile().then((profile) => {
            if (profile?.status === 'approved') {
                localStorage.setItem(cacheKey, JSON.stringify({ userId: session.user.id, approved: true }));
                setAccountCta();
            } else {
                clearAccountCache();
            }
        }).catch((error) => console.error('Member CTA status could not be refreshed:', error.message));
    }).catch((error) => console.error('Member session could not be loaded:', error.message));
}
