-- Expedientes digitales de Renta de Espacios - Museo Admin v4
-- Ejecutar una sola vez en Supabase SQL Editor.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'rental-documents',
  'rental-documents',
  false,
  15728640,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "rental documents museum upload" on storage.objects;
drop policy if exists "rental documents authorized read" on storage.objects;
drop policy if exists "rental documents authorized update" on storage.objects;
drop policy if exists "rental documents authorized delete" on storage.objects;

-- La primera carpeta de cada objeto siempre es el UUID del museo.
create policy "rental documents museum upload"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'rental-documents'
  and exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.museum_id::text = (storage.foldername(name))[1]
  )
);

create policy "rental documents authorized read"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'rental-documents'
  and exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.museum_id::text = (storage.foldername(name))[1]
      and lower(profiles.role) in ('administrador', 'ejecutivo')
  )
);

create policy "rental documents authorized update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'rental-documents'
  and exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.museum_id::text = (storage.foldername(name))[1]
      and lower(profiles.role) in ('administrador', 'ejecutivo')
  )
)
with check (
  bucket_id = 'rental-documents'
  and exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.museum_id::text = (storage.foldername(name))[1]
      and lower(profiles.role) in ('administrador', 'ejecutivo')
  )
);

create policy "rental documents authorized delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'rental-documents'
  and exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.museum_id::text = (storage.foldername(name))[1]
      and lower(profiles.role) in ('administrador', 'ejecutivo')
  )
);
