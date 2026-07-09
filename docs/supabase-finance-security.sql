do $$
begin
  if to_regclass('public.finance_records') is not null then
    execute 'alter table public.finance_records enable row level security';

    execute 'drop policy if exists "finance read only authorized museum users" on public.finance_records';
    execute 'drop policy if exists "finance insert only authorized museum users" on public.finance_records';
    execute 'drop policy if exists "finance update only authorized museum users" on public.finance_records';
    execute 'drop policy if exists "finance delete only authorized museum users" on public.finance_records';

    execute '
      create policy "finance read only authorized museum users"
      on public.finance_records
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.profiles
          where profiles.id = auth.uid()
            and profiles.museum_id = finance_records.museum_id
            and profiles.role in (''administrador'', ''ejecutivo'')
        )
      )
    ';

    execute '
      create policy "finance insert only authorized museum users"
      on public.finance_records
      for insert
      to authenticated
      with check (
        exists (
          select 1
          from public.profiles
          where profiles.id = auth.uid()
            and profiles.museum_id = finance_records.museum_id
            and profiles.role in (''administrador'', ''ejecutivo'')
        )
      )
    ';

    execute '
      create policy "finance update only authorized museum users"
      on public.finance_records
      for update
      to authenticated
      using (
        exists (
          select 1
          from public.profiles
          where profiles.id = auth.uid()
            and profiles.museum_id = finance_records.museum_id
            and profiles.role in (''administrador'', ''ejecutivo'')
        )
      )
      with check (
        exists (
          select 1
          from public.profiles
          where profiles.id = auth.uid()
            and profiles.museum_id = finance_records.museum_id
            and profiles.role in (''administrador'', ''ejecutivo'')
        )
      )
    ';

    execute '
      create policy "finance delete only authorized museum users"
      on public.finance_records
      for delete
      to authenticated
      using (
        exists (
          select 1
          from public.profiles
          where profiles.id = auth.uid()
            and profiles.museum_id = finance_records.museum_id
            and profiles.role in (''administrador'', ''ejecutivo'')
        )
      )
    ';
  end if;

  if to_regclass('public.audit_logs') is not null then
    execute 'alter table public.audit_logs enable row level security';

    execute 'drop policy if exists "finance audit read only authorized museum users" on public.audit_logs';
    execute 'drop policy if exists "finance audit insert only authorized museum users" on public.audit_logs';

    execute '
      create policy "finance audit read only authorized museum users"
      on public.audit_logs
      for select
      to authenticated
      using (
        table_name = ''finance_records''
        and exists (
          select 1
          from public.profiles
          where profiles.id = auth.uid()
            and profiles.museum_id = audit_logs.museum_id
            and profiles.role in (''administrador'', ''ejecutivo'')
        )
      )
    ';

    execute '
      create policy "finance audit insert only authorized museum users"
      on public.audit_logs
      for insert
      to authenticated
      with check (
        table_name = ''finance_records''
        and exists (
          select 1
          from public.profiles
          where profiles.id = auth.uid()
            and profiles.museum_id = audit_logs.museum_id
            and profiles.role in (''administrador'', ''ejecutivo'')
        )
      )
    ';
  end if;
end $$;
