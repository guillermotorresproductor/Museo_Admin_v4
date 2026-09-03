-- Corrects the inventory photo INSERT policy deployed in 202609010001.
-- The unqualified `name` inside its EXISTS was bound to inventory_items.name,
-- so every valid storage.objects row failed the item-id comparison.

create or replace function public.can_manage_inventory_photo(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    auth.uid() is not null
    and public.current_user_museum_id() is not null
    and public.has_permission('inventory.manage')
    and (storage.foldername(object_name))[1] = public.current_user_museum_id()::text
    and storage.filename(object_name) = 'main.webp'
    and exists (
      select 1
      from public.inventory_items i
      where i.museum_id = public.current_user_museum_id()
        and i.id::text = (storage.foldername(object_name))[2]
        and i.archived_at is null
    )
$$;

revoke all on function public.can_manage_inventory_photo(text) from public, anon;
grant execute on function public.can_manage_inventory_photo(text) to authenticated;

drop policy if exists inventory_photos_manage_insert on storage.objects;
create policy inventory_photos_manage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'inventory-photos'
    and public.can_manage_inventory_photo(name)
  );

drop policy if exists inventory_photos_manage_update on storage.objects;
create policy inventory_photos_manage_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'inventory-photos'
    and public.can_manage_inventory_photo(name)
  )
  with check (
    bucket_id = 'inventory-photos'
    and public.can_manage_inventory_photo(name)
  );

-- The RPCs already reject missing auth/permission internally. Remove the
-- explicit anon EXECUTE grants left by the project's default privileges.
revoke execute on function public.inventory_create(jsonb) from anon;
revoke execute on function public.inventory_update(uuid,bigint,jsonb) from anon;
revoke execute on function public.inventory_archive(uuid,bigint) from anon;
revoke execute on function public.inventory_set_photo(uuid,bigint) from anon;
revoke execute on function public.inventory_audit_changes() from anon, authenticated;
