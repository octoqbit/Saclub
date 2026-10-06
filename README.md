# Saclub

### Project pages and admin editing

Project cards and homepage project slides link to `/project.html?project=<slug>`. The public brief contains an overview, challenge, approach, features, components, milestones, and next steps. Member notes still load only after the existing approved-member check and database policy permit access.

In **Admin → Projects → Edit**, update the image, caption, GitHub repository URL, and public brief. List fields use one entry per line. “Feature near the start of the projects hero” prioritizes that project in the three-image hero collection. These fields save through the existing `save_content` function into `content.data`; the JSON column already supports these fields. Run `supabase/upgrade-existing.sql` to persist the new briefs for older concept rows without overwriting edits; see `supabase/UPGRADE.md` for the profile, member ID, and email redirect setup. Empty GitHub fields display “Repository link coming soon” rather than an invented repository. Public links accept HTTPS URLs on `github.com` with an owner and repository.

The original four concepts receive expanded proposed-build briefs and distinct artwork from `lib/project-data.mjs` when those fields are absent. Explicit admin values, including cleared fields, take precedence. Custom image URLs remain unchanged; only original shared rover/vision artwork is replaced for the four known concepts. Generated concept assets and their prompts are documented in `docs/project-artwork.md`.
### Search visibility and support

Public metadata, organization structured data, `public/robots.txt`, and `public/sitemap.xml` currently use `https://saclub.tech` as the production domain, with `https://saclub.tech/index.html` as the canonical homepage. If the production domain changes, update the absolute URLs in the public HTML files and these two crawler files together. Help Center opens a contact banner on the current page with Team SAC information and `info@saclub.tech`; privacy, cookies, and terms are standalone static pages included in the Vite build.

After deploying, verify the production domain in Google Search Console and submit `https://saclub.tech/sitemap.xml`. Request indexing of the homepage. Search ranking is determined by Google and cannot be guaranteed. Account and admin pages use `noindex`; authentication and database policies remain the actual access controls.

If production still issues IDs like `sac1001` or `SAC-1001`, apply `supabase/migrations/20261004_department_member_ids.sql` in the existing project's Supabase SQL editor. A frontend deployment does not apply SQL migrations. This migration preserves issued department IDs and converts legacy numbers using each profile's department. Review department values first; unrecognized values map to `OT`. The database regression suite verifies conversion, repeatability, per-department numbering, and reapproval stability. Do not rerun the initial schema against the existing project.
