import { hasSessionHint, isAuthCallback, loginHref } from './lib/session-hint.js';
// Direct bookmarks also skip the project bundle when there is no local session.
if (!hasSessionHint() && !isAuthCallback()) {
  location.replace(loginHref(location.pathname + location.search + location.hash));
} else {
  import('./project-detail.js');
}
