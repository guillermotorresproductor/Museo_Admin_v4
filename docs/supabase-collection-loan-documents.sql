-- Expedientes digitales de préstamo de colección - Museo Admin v4
-- Bucket privado: collection-loan-documents
-- Ejecutar una sola vez en Supabase SQL Editor (staging/production según corresponda).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'collection-loan-documents',
  'collection-loan-documents',
  false,
  15728640,
  array[
    'application/pdf',
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

drop policy if exists "collection loan documents museum upload" on storage.objects;
drop policy if exists "collection loan documents authorized read" on storage.objects;
drop policy if exists "collection loan documents authorized update" on storage.objects;
drop policy if exists "collection loan documents authorized delete" on storage.objects;
drop policy if exists "collection loan documents uploader delete" on storage.objects;

-- La primera carpeta de cada objeto siempre es el UUID del museo.
create policy "collection loan documents museum upload"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'collection-loan-documents'
  and exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.museum_id::text = (storage.foldername(name))[1]
  )
);

create policy "collection loan documents authorized read"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'collection-loan-documents'
  and exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.museum_id::text = (storage.foldername(name))[1]
      and lower(profiles.role) in ('administrador', 'ejecutivo')
  )
);

create policy "collection loan documents authorized update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'collection-loan-documents'
  and exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.museum_id::text = (storage.foldername(name))[1]
      and lower(profiles.role) in ('administrador', 'ejecutivo')
  )
)
with check (
  bucket_id = 'collection-loan-documents'
  and exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.museum_id::text = (storage.foldername(name))[1]
      and lower(profiles.role) in ('administrador', 'ejecutivo')
  )
);

create policy "collection loan documents authorized delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'collection-loan-documents'
  and exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.museum_id::text = (storage.foldername(name))[1]
      and lower(profiles.role) in ('administrador', 'ejecutivo')
  )
);

-- Permite al usuario que cargó un archivo eliminarlo si falla el registro del expediente.
create policy "collection loan documents uploader delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'collection-loan-documents'
  and owner = auth.uid()
  and exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.museum_id::text = (storage.foldername(name))[1]
  )
);
