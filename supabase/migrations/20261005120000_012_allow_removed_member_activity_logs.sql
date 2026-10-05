-- Removal logs intentionally survive user profile deletion, so the user reference may become NULL.
alter table public.activity_log alter column user_id drop not null;
