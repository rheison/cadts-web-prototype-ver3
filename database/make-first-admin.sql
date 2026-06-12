-- Run this after creating your first account from the website.
-- Replace the email address with your own registered account email.

update public.profiles
set role = 'admin'
where email = 'admin@cadts.local';
