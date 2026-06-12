# GitHub Pages Setup

## Fresh repository option

1. Create a new GitHub repository.
2. Upload all files from this folder into the repository root.
3. Commit the files to the `main` branch.
4. Go to `Settings -> Pages`.
5. Choose:

```text
Source: Deploy from a branch
Branch: main
Folder: /root
```

6. Save.

Your site will be available at:

```text
https://YOUR-GITHUB-USERNAME.github.io/YOUR-REPOSITORY-NAME/
```

For the user's Version 2 project, the expected URL is:

```text
https://rheison.github.io/cadts-web-prototype-ver2/
```

## Existing repository option

If you want a clean start in the existing Version 2 repository:

1. Download a backup of the current repository first.
2. Delete the old frontend files.
3. Upload these fresh-start files.
4. Update `supabase-config.js` with your Supabase URL and anon key.
5. Commit and push.
6. Wait for GitHub Pages to redeploy.

## Test checklist

After deployment:

1. Open the GitHub Pages URL.
2. Confirm the Supabase warning is gone.
3. Create a new account.
4. Run the SQL command to make the first account an admin.
5. Log out and log back in.
6. Create another user account.
7. Log in as admin and change that user to Approver, Technician, or Auditor.
8. Confirm only Customer / Asset Owner accounts can see the create ticket form.
