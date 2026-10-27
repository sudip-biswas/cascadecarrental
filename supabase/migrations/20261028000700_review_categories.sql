-- Turo's five review categories and the issue tags guests pick when a
-- category falls short. rating_value stays for older reviews but the form no
-- longer asks for it. protect_review_columns already copies every column from
-- the old row except the reply, so these are covered without changes.

alter table public.reviews
  add column if not exists rating_maintenance smallint check (rating_maintenance between 1 and 5);
alter table public.reviews
  add column if not exists rating_communication smallint check (rating_communication between 1 and 5);
alter table public.reviews
  add column if not exists rating_convenience smallint check (rating_convenience between 1 and 5);
alter table public.reviews
  add column if not exists issue_tags text[] not null default '{}';

-- The host ratings page reads one host's guest reviews, newest first.
create index if not exists idx_reviews_reviewee_created
  on public.reviews (reviewee_id, created_at desc);
