-- CAE Knowledge Base V4 — Phase 4: a signed-in user may EDIT the entries they created.
-- Run once in the V4 project's SQL Editor (safe to re-run). Run schema.sql, phase2 and phase3 first.
--
-- What this allows:
--   * a signed-in user can update an entry only when entries.user_id = their own id, and only these content columns:
--     title, category, tags, symptom, root_cause, solution, failed_attempts, notes, reference_source, images
--   * the author (user_id), id, created_at and views can NOT be changed through the API
--     (updated_at is set by the existing trigger)
-- Unchanged: anonymous visitors stay read-only; sample entries (no author) and other people's entries cannot be edited.

grant update (title, category, tags, symptom, root_cause, solution, failed_attempts, notes, reference_source, images)
  on public.entries to authenticated;

drop policy if exists entries_author_update on public.entries;
create policy entries_author_update on public.entries
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
