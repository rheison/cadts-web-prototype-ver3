# CADTS SecureDestroy Version 3 Fresh Start

This is a GitHub Pages-ready working prototype for the CADTS / SecureDestroy Cloud Asset Destruction Tracking System.

It uses:

- GitHub Pages for the public web app
- Supabase Auth for user login and account creation
- Supabase Postgres for the hosted database
- Supabase Storage for technician evidence uploads
- Row Level Security to enforce role-based access

## Main prototype behavior

| Role | Can create account? | Can create destruction ticket? | Main purpose |
|---|---:|---:|---|
| Customer / Asset Owner | Yes | Yes | Register assets and submit destruction requests |
| Admin | Yes, by self-registration first | No | Assign roles and manage workflow oversight |
| Approver | Yes, by self-registration first | No | Approve or reject submitted requests |
| Technician | Yes, by self-registration first | No | Upload ticket evidence, add destruction notes, and certify completion |
| Auditor | Yes, by self-registration first | No | Review reports, audit logs, and add post-closeout ticket notes |

New users always start as `customer`. An admin can change roles from the User Management screen.

## Files

```text
index.html
styles.css
app.js
supabase-config.js
supabase-config.template.js
database/schema.sql
database/make-first-admin.sql
docs/github-pages-setup.md
docs/supabase-setup.md
.nojekyll
```

## Quick setup

### 1. Create a free Supabase project

Create a Supabase project and copy:

- Project URL
- anon public key / publishable key

### 2. Create the database

Open Supabase SQL Editor and run:

```text
database/schema.sql
```

### 3. Configure authentication

In Supabase, go to:

```text
Authentication -> URL Configuration
```

Set your Site URL to your GitHub Pages URL, for example:

```text
https://rheison.github.io/cadts-web-prototype-ver3/
```

Add this Redirect URL:

```text
https://rheison.github.io/cadts-web-prototype-ver3/**
```

For an easy classroom demo, go to:

```text
Authentication -> Providers -> Email
```

Then disable email confirmation. For a production version, enable confirmation.

Password reset uses Supabase email links. Keep the GitHub Pages Site URL and Redirect URL configured so the reset email returns users to the prototype.

### 4. Add your Supabase values

Open `supabase-config.js` and replace:

```javascript
const SUPABASE_URL = "PASTE_YOUR_SUPABASE_PROJECT_URL_HERE";
const SUPABASE_ANON_KEY = "PASTE_YOUR_SUPABASE_ANON_PUBLIC_KEY_HERE";
```

Do not use the Supabase `service_role` key in this project.

If your GitHub repository already has a working `supabase-config.js`, do not overwrite it with a placeholder copy. Use `supabase-config.template.js` only as a reference.

### 5. Upload to GitHub

Upload all files to your repository root.

Then enable GitHub Pages:

```text
Repository -> Settings -> Pages -> Deploy from a branch -> main -> /root
```

### 6. Create the first admin

Open the website and create your first account.

Then run this SQL in Supabase after changing the email address:

```sql
update public.profiles
set role = 'admin'
where email = 'admin@cadts.local';
```

After that, log in as the admin and use User Management to assign other roles.

## Demo accounts

These accounts can be created from the website or used if you already created them:

| Role | Email | Password |
|---|---|---|
| Admin | admin@cadts.local | Demo123! |
| Customer / Asset Owner | customer@cadts.local | Demo123! |
| Approver | approver@cadts.local | Demo123! |
| Technician | technician@cadts.local | Demo123! |
| Auditor | auditor@cadts.local | Demo123! |

Then update their roles from the Admin dashboard.

## Classroom demonstration flow

1. Customer creates account.
2. Customer registers an asset.
3. Customer creates a destruction ticket.
4. Approver approves the ticket.
5. Technician uploads evidence such as a photo, screenshot, PDF, or document to the ticket.
6. Technician marks the ticket destroyed and certifies the ticket after evidence is attached.
7. Auditor or Admin reviews reports and audit logs.
8. Auditor adds a post-closeout note or comment to the certified ticket.

## Important security note

This project is safe for GitHub Pages because it only uses the Supabase anon key. Access control is enforced by Supabase Row Level Security policies in `database/schema.sql`.
