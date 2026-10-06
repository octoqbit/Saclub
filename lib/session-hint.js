// A routing hint only. Supabase and database policies still verify membership.
export function hasSessionHint() {
  try {
    const url = import.meta.env.VITE_SUPABASE_URL;
    if (!url) return false;
    const key = `sb-${new URL(url).hostname.split('.')[0]}-auth-token`;
    const session = JSON.parse(localStorage.getItem(key) || 'null');
    return Boolean(session?.access_token && session?.user);
  } catch { return true; } // Let the real auth check handle unavailable storage.
}
export function loginHref(next) { return `/account?next=${encodeURIComponent(next)}`; }
export function isAuthCallback() {
  const query = new URLSearchParams(location.search);
  return query.has('code') || query.has('confirmed') || /(?:access_token|refresh_token|type)=/.test(location.hash);
}
