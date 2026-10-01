-- CAE Knowledge Base V4 — Phase 3: a signed-in user may DELETE the entries they created.
-- Run once in the V4 project's SQL Editor (safe to re-run). Run schema.sql and phase2-auth-write.sql first.
--
-- What this allows:
--   * a signed-in user can delete an entry only when entries.user_id = their own id
--     (the sample/seed entries have no author, so nobody can delete them through the site)
--   * a signed-in user can delete image files only inside their OWN folder of kb-images (<user id>/…)
-- Unchanged: anonymous visitors stay read-only; nobody can UPDATE entries or images through the API.

grant delete on public.entries to authenticated;

drop policy if exists entries_author_delete on public.entries;
create policy entries_author_delete on public.entries
  for delete to authenticated
  using (user_id = auth.uid());

drop policy if exists kb_images_author_delete on storage.objects;
create policy kb_images_author_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'kb-images' and (storage.foldername(name))[1] = auth.uid()::text);
