-- Photos in messages. Each message can carry up to six photos, stored in a
-- private bucket under the sender's id. Only the two people in the
-- conversation can read them; the server hands out short-lived links.
-- Additive and safe to run more than once.

alter table public.messages
  -- Storage paths in the message-photos bucket, "<sender id>/<uuid>.<ext>".
  add column if not exists photos text[] not null default '{}';

-- A sender can only attach their own uploads, and a message needs words or a photo.
create or replace function public.message_photos_ok(p_sender uuid, p_photos text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(array_length(p_photos, 1), 0) <= 6
    and not exists (select 1 from unnest(p_photos) p where p not like p_sender::text || '/%');
$$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'messages_photos_check') then
    alter table public.messages add constraint messages_photos_check
      check (public.message_photos_ok(sender_id, photos));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'messages_body_or_photo') then
    alter table public.messages add constraint messages_body_or_photo
      check (char_length(btrim(body)) > 0 or coalesce(array_length(photos, 1), 0) > 0);
  end if;
end $$;

grant select (photos), insert (photos) on public.messages to authenticated;

-- ---------------------------------------------------------------------------
-- Private bucket: 10 MB images only
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('message-photos', 'message-photos', false, 10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Uploads go through the server. Reading: your own uploads, or a photo sent
-- in a conversation you're in, so the thread can sign links for new messages.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'message_photos_read') then
    create policy message_photos_read on storage.objects for select to authenticated using (
      bucket_id = 'message-photos' and (
        (storage.foldername(name))[1] = auth.uid()::text
        or exists (
          select 1 from public.messages m
          join public.conversations c on c.id = m.conversation_id
          where objects.name = any(m.photos) and (c.guest_id = auth.uid() or c.host_id = auth.uid())
        )
      )
    );
  end if;
end $$;

create index if not exists idx_messages_photos on public.messages using gin (photos);
