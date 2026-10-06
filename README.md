# Saclub

### Project pages and admin editing

The projects page, cards, summaries, and banners are public. Opening a project requires a signed-in, approved member; visitors go to sign-in with a return link. Pending, rejected, and suspended accounts cannot open full details.

Briefs, features, components, milestones, next steps, repository links, and member notes are stored in `content_details`, protected by database row-level security. Only preview fields remain in `content.data`. The database moves other project fields to protected storage automatically, including when admins save through `save_content`. The public JavaScript bundle contains artwork defaults only.

**Existing database:** run [the project-access migration](supabase/migrations/20261006_project_member_access.sql) in Supabase SQL Editor **before deploying the frontend**. It preserves existing notes and edited fields and is safe to rerun. This is also included in `upgrade-existing.sql`; new installations use `schema.sql` then `seed.sql`. A frontend deployment alone does not update database access.

In **Admin → Projects → Edit**, update public artwork and introductions separately from member-only details. List fields use one entry per line. Project repository links accept GitHub HTTPS URLs. Generated artwork is documented in `docs/project-artwork.md`.

### Event access and faster navigation

In **Admin → Events → Edit → Visibility → Event access**, choose **Public** or **Members only**. Published previews remain visible to everyone. Public events open without login; members-only event details require approved membership. Registration still requires an approved member. Existing events stay members-only until explicitly changed.

Apply [the event-access migration](supabase/migrations/20261006_event_access.sql) to the existing database before deploying this frontend. It is also included in the combined upgrade and new-install schema. This grants anonymous reads only for explicitly public, published event details through row-level security; project details and drafts remain protected.

Timed boot screens have been removed. Guest project clicks go directly to login with the project return URL, and direct project bookmarks skip the project bundle for guests. Session hints only speed up routing; actual member access still uses verified authentication and database policies. Project controls and content requests no longer wait on website text requests.

### Search visibility and support

Public metadata, organization structured data, `public/robots.txt`, and `public/sitemap.xml` currently use `https://saclub.tech` as the production domain, with `https://saclub.tech/index.html` as the canonical homepage. If the production domain changes, update the absolute URLs in the public HTML files and these two crawler files together. Help Center opens a contact banner on the current page with Team SAC information and `info@saclub.tech`; privacy, cookies, and terms are standalone static pages included in the Vite build.

After deploying, verify the production domain in Google Search Console and submit `https://saclub.tech/sitemap.xml`. Request indexing of the homepage. Search ranking is determined by Google and cannot be guaranteed. Account and admin pages use `noindex`; authentication and database policies remain the actual access controls.

If production still issues IDs like `sac1001` or `SAC-1001`, apply `supabase/migrations/20261004_department_member_ids.sql` in the existing project's Supabase SQL editor. A frontend deployment does not apply SQL migrations. This migration preserves issued department IDs and converts legacy numbers using each profile's department. Review department values first; unrecognized values map to `OT`. The database regression suite verifies conversion, repeatability, per-department numbering, and reapproval stability. Do not rerun the initial schema against the existing project.
