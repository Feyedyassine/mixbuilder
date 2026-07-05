-- Track metadata (title / artist / genre), keyed by audio content hash.
-- Anonymous + shared like track_features: readable and contributable by any
-- authenticated user, immutable (first writer wins), no user_id. It identifies the
-- track, not who analyzed it — seeds catalog analytics (top artists/genres) without
-- linking to individuals. Covers are intentionally NOT stored here (deferred; large
-- + copyrighted — a bucket + downscaled thumbnails when the library needs them).

create table public.track_metadata (
  content_hash text primary key,
  title        text,
  artist       text,
  genre        text,
  created_at   timestamptz not null default now()
);

alter table public.track_metadata enable row level security;

create policy "track_metadata: select authenticated"
  on public.track_metadata for select to authenticated
  using (true);

create policy "track_metadata: insert authenticated"
  on public.track_metadata for insert to authenticated
  with check (true);
