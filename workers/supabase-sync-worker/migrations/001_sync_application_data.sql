-- Jalankan file ini pada SQL Editor di SETIAP project Supabase.

create table if not exists public.app_configurations (
    id uuid primary key default gen_random_uuid(),
    key_name text not null unique,
    last_sync_timestamp timestamptz not null default now(),
    metadata jsonb not null default '{}'::jsonb
);

-- Versi lama memakai RETURNS JSON, sedangkan versi baru memakai JSONB.
-- PostgreSQL tidak bisa mengganti tipe hasil lewat CREATE OR REPLACE,
-- jadi fungsi lama tanpa parameter perlu dihapus terlebih dahulu.
-- Ini hanya menghapus fungsi, bukan tabel atau data app_configurations.
drop function if exists public.sync_application_data();

create or replace function public.sync_application_data()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
    affected_rows integer;
begin
    insert into public.app_configurations (
        key_name,
        last_sync_timestamp,
        metadata
    )
    values (
        'system_sync_service',
        now(),
        jsonb_build_object(
            'service', 'supabase_sync_worker',
            'version', '2.0.0',
            'last_status', 'success'
        )
    )
    on conflict (key_name) do update
    set last_sync_timestamp = excluded.last_sync_timestamp,
        metadata = coalesce(public.app_configurations.metadata, '{}'::jsonb)
            || excluded.metadata;

    get diagnostics affected_rows = row_count;

    return jsonb_build_object(
        'status', 'synchronized',
        'timestamp', now(),
        'affected_rows', affected_rows,
        'version', '2.0.0'
    );
end;
$$;

revoke all on function public.sync_application_data() from public;
grant execute on function public.sync_application_data() to anon, authenticated;

-- Tes kecil. Hasil affected_rows harus bernilai 1.
select public.sync_application_data();
