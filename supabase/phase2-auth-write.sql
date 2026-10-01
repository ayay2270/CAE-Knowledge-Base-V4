-- CAE Knowledge Base V4 — Phase 2: signed-in users may ADD knowledge.
-- Run once in the V4 project's SQL Editor (safe to re-run). Run supabase/schema.sql first.
--
-- What this allows:
--   * a signed-in user (role `authenticated`) can INSERT rows into public.entries, only with user_id = their own id
--   * a signed-in user can upload an image into their OWN folder of the private bucket kb-images (<user id>/<file>)
-- What stays forbidden:
--   * anonymous visitors: read only (unchanged) — no insert / update / delete anywhere
--   * nobody (including signed-in users) can UPDATE or DELETE entries or images through the API in this phase
--   * software_categories stays read-only for everyone

-- ---- entries: insert for the signed-in author -------------------------------------------------
grant insert on public.entries to authenticated;

drop policy if exists entries_author_insert on public.entries;
create policy entries_author_insert on public.entries
  for insert to authenticated
  with check (user_id = auth.uid());

-- ---- storage: upload into own folder of kb-images ----------------------------------------------
drop policy if exists kb_images_author_insert on storage.objects;
create policy kb_images_author_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'kb-images' and (storage.foldername(name))[1] = auth.uid()::text);
