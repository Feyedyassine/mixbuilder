-- Store the filename per user_tracks entry so a set built from the future library
-- (which has no audio file present) can still export a usable playlist. Per-user
-- because different rips of the same track can have different filenames.

alter table public.user_tracks add column file_name text;
