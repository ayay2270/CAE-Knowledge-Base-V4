-- CAE Knowledge Base V4 — Supabase schema, phase 1 (public READ-ONLY site)
--
-- HOW TO USE
--   1. Create a NEW Supabase project for V4 (do not use the V2 production or V3 development project).
--   2. Open SQL Editor, paste this whole file and Run. Re-running is safe.
--   3. Then run supabase/seed.sql to load the sample data (optional but recommended for the first check).
--
-- This phase only lets anonymous visitors READ. No insert / update / delete policy exists yet, so nobody can
-- write through the API. Write access, login and image upload are added in a later phase.
-- Based on the V2/V3 structure (same columns), with these deliberate differences:
--   * entries.user_id is nullable (seed data has no author yet) and uses ON DELETE SET NULL
--   * software_categories has a `description` column
--   * no write policies, no increment_views()

-- 1. Software categories (software -> sub-software). `key` is a stable internal code, `label` is what people see.
create table if not exists public.software_categories (
  key text primary key,
  label text not null,
  parent_key text null,
  description text not null default '',
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint software_categories_parent_key_fkey
    foreign key (parent_key) references public.software_categories (key) on delete restrict
);

-- 2. Knowledge entries
create table if not exists public.entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null default auth.uid() references auth.users(id) on delete set null,
  title text not null,
  category text not null references public.software_categories (key) on delete restrict,
  tags text[] not null default '{}',
  symptom text not null default '',
  root_cause text not null default '',
  solution text not null default '',
  failed_attempts text[] not null default '{}',
  notes text not null default '',
  reference_source text not null default '',
  -- images: [{ "path": "<object path in bucket kb-images>" | "src": "<static url>",
  --            "caption": "...", "title": "...", "section": "symptom|root_cause|solution|fails|note|ref",
  --            "step": 0 | 1 | 2 ... | "v", "order": 1, "key": true, "mock": true }]
  images jsonb not null default '[]'::jsonb,
  views integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists entries_category_idx on public.entries (category);
create index if not exists entries_updated_at_idx on public.entries (updated_at desc);

-- 3. updated_at only moves when the content changes (not when views change)
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  if (to_jsonb(new) - 'views' - 'updated_at') is distinct from (to_jsonb(old) - 'views' - 'updated_at') then
    new.updated_at = now();
  end if;
  return new;
end $$;

drop trigger if exists entries_touch on public.entries;
create trigger entries_touch before update on public.entries
for each row execute function public.touch_updated_at();

drop trigger if exists software_categories_touch on public.software_categories;
create trigger software_categories_touch before update on public.software_categories
for each row execute function public.touch_updated_at();

-- 4. Row Level Security: public read only
alter table public.entries enable row level security;
alter table public.software_categories enable row level security;

drop policy if exists "entries_public_read" on public.entries;
create policy "entries_public_read" on public.entries
  for select to anon, authenticated using (true);

drop policy if exists "software_categories_public_read" on public.software_categories;
create policy "software_categories_public_read" on public.software_categories
  for select to anon, authenticated using (is_active = true);

-- Table privileges: read only (belt and braces on top of RLS)
revoke all on public.entries from anon, authenticated;
revoke all on public.software_categories from anon, authenticated;
grant select on public.entries to anon, authenticated;
grant select on public.software_categories to anon, authenticated;

-- 5. Image storage: PRIVATE bucket, readable (via signed URLs) by the public site, no upload policy yet
insert into storage.buckets (id, name, public)
values ('kb-images', 'kb-images', false)
on conflict (id) do nothing;

drop policy if exists "kb_images_public_read" on storage.objects;
create policy "kb_images_public_read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'kb-images');
