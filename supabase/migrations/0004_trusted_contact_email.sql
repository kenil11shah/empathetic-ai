-- Trusted contacts can have an email address, so the user can reach them in one tap.
-- The app never sends anything itself: links open the user's own email, SMS or phone app.
alter table public.trusted_contacts add column if not exists email text;
do $$ begin
  alter table public.trusted_contacts add constraint trusted_contacts_email_len check (email is null or char_length(email) <= 254);
exception when duplicate_object then null;
end $$;
