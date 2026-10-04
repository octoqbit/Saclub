import { createClient } from '@supabase/supabase-js';

export const configured = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
export const googleEnabled = import.meta.env.VITE_GOOGLE_AUTH_ENABLED === 'true';
export const supabase = configured ? createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY) : null;
export const setupMessage = 'Member services are not connected yet. Please check back soon.';
export function client() { if (!supabase) throw new Error(setupMessage); return supabase; }
export function checked(result) { if (result.error) throw result.error; return result.data; }
export async function currentProfile() {
  if (!supabase) return null;
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return checked(await supabase.from('profiles').select('*').eq('id', user.id).single());
}
export async function requireMember() {
  const profile = await currentProfile();
  if (!profile || profile.status !== 'approved') {
    location.assign(`/account?next=${encodeURIComponent(location.pathname + location.search + location.hash)}`);
    return null;
  }
  return profile;
}
export function safeNext(value) {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/account';
  const parsed = new URL(value, location.origin);
  return parsed.origin === location.origin ? parsed.pathname + parsed.search + parsed.hash : '/account';
}
export async function uploadImage(file) {
  if (!file || !['image/jpeg','image/png','image/webp','image/gif'].includes(file.type) || file.size > 5 * 1024 * 1024) throw new Error('Choose a JPG, PNG, WebP, or GIF image under 5 MB.');
  const path = `${crypto.randomUUID()}.${{ 'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif' }[file.type]}`;
  checked(await client().storage.from('content-images').upload(path,file,{ contentType:file.type }));
  return client().storage.from('content-images').getPublicUrl(path).data.publicUrl;
}
