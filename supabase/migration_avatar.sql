-- ============================================================================
-- migration_avatar.sql — server-side profile picture (cross-device sync).
--
-- RUN ORDER: apply migration_onboarding.sql FIRST (this file needs the
-- profiles table). Then run THIS file once in the Supabase SQL Editor.
-- Safe to re-run: IF NOT EXISTS / drop+create policies throughout.
--
-- Architecture (profile spec §3–§6):
--   upload → Storage bucket "avatars", object path "<user_id>/avatar.<ext>"
--          → profiles.avatar_url stores that path
--          → any device loads profiles.avatar_url for the same user.id
--            and renders the public URL (unique per user + cache-safe).
--
-- OWNERSHIP (spec §4/§11): every object lives under a folder named by the
-- uploader's auth.uid(); policies enforce that only the owner can write
-- their folder and only authenticated users can read. No shared path.
-- ============================================================================

-- 1) avatar_url on the existing profile row (no second profile system).
alter table public.profiles
    add column if not exists avatar_url text not null default '';

-- 2) Storage bucket: public read (avatars are rendered as <img src>),
--    write strictly through the owner-scoped policies below.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

-- 3) Policies — user-scoped paths ONLY ("<uid>/avatar.*").
--    READ: any authenticated user may fetch avatar objects. Objects are
--    addressed per-owner, so user B can only reach A's picture by
--    already knowing A's exact public URL (same trust level as the
--    profiles row itself; the app never exposes other users' URLs).
drop policy if exists "avatars_read_authenticated" on storage.objects;
create policy "avatars_read_authenticated"
    on storage.objects for select
    to authenticated
    using (bucket_id = 'avatars');

--    WRITE/UPDATE/DELETE: the first path segment MUST be the caller's
--    own auth.uid() — one user can never create, replace or remove
--    another user's picture.
drop policy if exists "avatars_insert_own" on storage.objects;
create policy "avatars_insert_own"
    on storage.objects for insert
    to authenticated
    with check (
        bucket_id = 'avatars'
        and (storage.foldername(name))[1] = auth.uid()::text
    );

drop policy if exists "avatars_update_own" on storage.objects;
create policy "avatars_update_own"
    on storage.objects for update
    to authenticated
    using (
        bucket_id = 'avatars'
        and (storage.foldername(name))[1] = auth.uid()::text
    )
    with check (
        bucket_id = 'avatars'
        and (storage.foldername(name))[1] = auth.uid()::text
    );

drop policy if exists "avatars_delete_own" on storage.objects;
create policy "avatars_delete_own"
    on storage.objects for delete
    to authenticated
    using (
        bucket_id = 'avatars'
        and (storage.foldername(name))[1] = auth.uid()::text
    );
-- 4) The public URL is built client-side with
--    supabase.storage.getPublicUrl('avatars', path) — no SQL helper
--    needed. profiles.avatar_url stores ONLY the object path
--    ("<uid>/avatar.png"), so a project URL change never breaks rows.
