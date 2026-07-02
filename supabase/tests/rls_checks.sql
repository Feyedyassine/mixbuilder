-- RLS verification for schema v1 (plan Task 1.2.3).
-- Run in the Supabase SQL editor AFTER creating two test users (sign them up in
-- the app or dashboard), then paste their UUIDs below. The whole script runs in a
-- transaction and ROLLS BACK, so it leaves no data behind.
--
-- Expected result: every SELECT labelled EXPECT below returns the stated value.
-- Any mismatch is an RLS defect.

\set user_a '00000000-0000-0000-0000-00000000000a'
\set user_b '00000000-0000-0000-0000-00000000000b'

begin;

-- Helper: impersonate a user for RLS (sets role + JWT sub claim).
create or replace function pg_temp.act_as(uid uuid) returns void
language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', uid::text, 'role', 'authenticated')::text,
    true
  );
end;
$$;

-- ── sets: a user sees only their own rows ────────────────────────────────────
select pg_temp.act_as(:'user_a');
insert into public.sets (user_id, name) values (:'user_a', 'A''s set');

-- EXPECT 1: user A sees their own set
select count(*) as a_sees_own from public.sets;

select pg_temp.act_as(:'user_b');
-- EXPECT 0: user B cannot see A's set
select count(*) as b_sees_a from public.sets;

-- EXPECT error / 0 rows affected: user B cannot insert a set owned by A
-- (uncomment to confirm it raises a row-level-security violation)
-- insert into public.sets (user_id, name) values (:'user_a', 'B forging A');

-- ── track_features: readable by any authenticated user ───────────────────────
select pg_temp.act_as(:'user_a');
insert into public.track_features (content_hash, schema_version, features)
values ('hash-shared', 1, '{"bpm":128}'::jsonb);

select pg_temp.act_as(:'user_b');
-- EXPECT 1: the community cache row is visible to a different user
select count(*) as b_sees_shared_feature from public.track_features
where content_hash = 'hash-shared';

rollback;
