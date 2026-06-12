# Supabase Setup for CADTS SecureDestroy

## 1. Create project

Create a free Supabase project named:

```text
cadts-securedestroy
```

Save the database password somewhere safe.

## 2. Run the database schema

Open:

```text
Supabase -> SQL Editor -> New Query
```

Paste and run the contents of:

```text
database/schema.sql
```

## 3. Configure Auth redirects

Open:

```text
Authentication -> URL Configuration
```

Use your GitHub Pages URL as the Site URL:

```text
https://rheison.github.io/cadts-web-prototype-ver3/
```

Add this redirect URL:

```text
https://rheison.github.io/cadts-web-prototype-ver3/**
```

## 4. Configure email login

Open:

```text
Authentication -> Providers -> Email
```

For a classroom demo:

```text
Email provider: Enabled
Confirm email: Disabled
```

For a real deployment:

```text
Email provider: Enabled
Confirm email: Enabled
```

## 5. Connect the website

Open `supabase-config.js` and paste your project values:

```javascript
const SUPABASE_URL = "https://your-project-ref.supabase.co";
const SUPABASE_ANON_KEY = "your-anon-public-key";
```

Never paste the service role key into GitHub Pages.

## 6. Create first admin

Create an account through the website first. Then run:

```sql
update public.profiles
set role = 'admin'
where email = 'admin@cadts.local';
```

Change the email to your actual first account email.
