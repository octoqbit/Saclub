# Upgrade the existing SAC Supabase project

The code changes are local. The hosted Supabase database and Auth settings must also be updated. The steps below use the production domain `https://saclub.tech` and club GitHub `https://github.com/SAclub`.

## 1. Apply the database upgrade

Open your existing project in Supabase → SQL Editor → New query. Copy the **entire contents of [upgrade-existing.sql](upgrade-existing.sql)** and click Run. Use the existing project that your website connects to. Do not run `schema.sql` or `seed.sql` again on that database.

The upgrade commits as one transaction and can be rerun safely. It:

- Converts legacy IDs such as `sac1004` to `SAC-CS-001`, `SAC-EC-001`, etc., according to each member’s department. Existing valid department IDs stay the same. Each department has its own counter. User UUIDs, passwords, approval status, and registrations stay intact.
- Uses codes `CS`, `EC`, `EE`, `ME`, and `OT`. Blank or unrecognized department names use `OT`. Check the `department` column first if you need to correct one.
- Preserves existing He/Him and She/Her selections in `profiles.pronouns`, locks them after selection, and adds eight editable emoji choices in `profiles.avatar`. Existing members start with 🤖; admins use the laptop-person emoji. New OAuth users choose pronouns when completing their application.
- Writes missing public brief fields and replacement concept artwork into the existing `content.data` and image columns. Explicit admin edits, empty fields, custom images, private notes, visibility, and deleted projects are preserved.
- Updates the signup trigger and profile/application RPCs; ordinary users still cannot change roles, approval status, member IDs, or project content.

The final query shows the resulting member IDs. For a separate verification, run:

```sql
select member_id, department, status, pronouns, avatar
from public.profiles order by created_at;

select slug, data->>'overview' as overview,
       data->>'githubUrl' as github_url, image
from public.content where kind='project' order by sort_order;
```

The project editor already uses `save_content` to save new fields in `content.data`. No new project table is needed. The upgrade backfills the original four concept rows; it does not invent completed projects or repository URLs. Add actual club projects and their individual repository links through **Admin → Projects**. The club organization link is `https://github.com/SAclub`.

## 2. Fix email confirmation redirects

In Supabase → **Authentication → URL Configuration**:

Set **Site URL** to:

```
https://saclub.tech/account
```

Add these **Redirect URLs**:

```
https://saclub.tech/account
https://saclub.tech/account?mode=login&confirmed=1
https://saclub.tech/account?mode=reset
```

If Google login is enabled and you use return links, also allow the app’s account query variants with `https://saclub.tech/account?next=*`. Keep local development URLs only if you still need local OAuth testing. The production Site URL must not be localhost.

In **Authentication → Email Templates → Confirm signup**, keep the confirmation button linked to Supabase’s verification URL:

```html
<a href="{{ .ConfirmationURL }}">Confirm your email</a>
```

Remove hard-coded localhost links. Do not link straight to the website or to `{{ .RedirectTo }}` alone: the email must first verify the token. This app uses the standard Supabase browser confirmation flow, not a custom `/auth/confirm` endpoint.

In the website hosting environment (for example, Vercel), add:

```
VITE_SITE_URL=https://saclub.tech
```

Apply the SQL upgrade, then deploy this updated app. Vite embeds this variable at build time, so redeploy after changing it. Signup emails now request `https://saclub.tech/account?mode=login&confirmed=1`, including when an application is submitted locally. After verification, the app ends the temporary confirmation session on that browser and displays the account sign-in form. Password-reset emails go to `/account?mode=reset`.

Test with a **newly sent** confirmation email after saving these settings. Existing emails can still contain the previous localhost redirect. Confirm that the new link reaches the live login page, then sign in and check the application status. Also smoke-test password recovery.

References: [Supabase redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls), [Supabase email templates](https://supabase.com/docs/guides/auth/auth-email-templates).

## 3. Project publishing requirement

The member account page (including pending accounts), projects page, about page, Terms of Service, and Privacy Policy now state that every project developed under SAC must be published on the club website and uploaded to the official SAC GitHub organization. Members may also post the same projects on their personal GitHub profiles.

Members send project details to the SAC team; admins publish website entries through the existing project editor. These changes do not upload repositories automatically or grant members access to the club GitHub organization.
