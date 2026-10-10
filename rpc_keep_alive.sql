-- ==============================================================================
-- KETOKO POS — SUPABASE KEEP-ALIVE & STORAGE MONITOR RPC FUNCTION (v2.1.0)
-- Jalankan skrip ini di SQL Editor pada project Supabase Anda (quhjgsoqjcumckoshjtv)
-- untuk mengaktifkan Keep-Alive dan Monitoring Kuota Storage 500 MB Free-Tier
-- ==============================================================================

-- 1. Buat tabel konfigurasi sync jika belum ada
CREATE TABLE IF NOT EXISTS public.app_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key_name TEXT NOT NULL UNIQUE,
    last_sync_timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- 2. Kebijakan Row Level Security
ALTER TABLE public.app_configurations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read/write app_configurations" ON public.app_configurations;
CREATE POLICY "Allow public read/write app_configurations" ON public.app_configurations FOR ALL USING (true) WITH CHECK (true);

-- 3. Hapus fungsi lama bila ada
DROP FUNCTION IF EXISTS public.sync_application_data();

-- 4. Buat fungsi RPC keep-alive & storage monitor
CREATE OR REPLACE FUNCTION public.sync_application_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    affected_rows integer;
    db_size_bytes bigint;
    db_size_mb numeric;
    quota_mb numeric := 500.0;
    percent_used numeric;
BEGIN
    -- Hitung ukuran database terkini
    BEGIN
        SELECT pg_database_size(current_database()) INTO db_size_bytes;
        db_size_mb := ROUND((db_size_bytes::numeric / (1024 * 1024)), 2);
        percent_used := ROUND((db_size_mb / quota_mb) * 100, 1);
    EXCEPTION WHEN OTHERS THEN
        db_size_mb := 0;
        percent_used := 0;
    END;

    INSERT INTO public.app_configurations (
        key_name,
        last_sync_timestamp,
        metadata
    )
    VALUES (
        'system_sync_service',
        now(),
        jsonb_build_object(
            'service', 'supabase_sync_worker',
            'version', '2.1.0',
            'last_status', 'success',
            'db_size_mb', db_size_mb,
            'percent_used', percent_used
        )
    )
    ON CONFLICT (key_name) DO UPDATE
    SET last_sync_timestamp = excluded.last_sync_timestamp,
        metadata = coalesce(public.app_configurations.metadata, '{}'::jsonb)
            || excluded.metadata;

    GET DIAGNOSTICS affected_rows = row_count;

    RETURN jsonb_build_object(
        'status', 'synchronized',
        'timestamp', now(),
        'affected_rows', affected_rows,
        'version', '2.1.0',
        'db_size_mb', db_size_mb,
        'quota_mb', quota_mb,
        'percent_used', percent_used
    );
END;
$$;

-- 5. Berikan izin eksekusi ke anon & authenticated
REVOKE ALL ON FUNCTION public.sync_application_data() FROM public;
GRANT EXECUTE ON FUNCTION public.sync_application_data() TO anon, authenticated;

-- 6. Tes eksekusi. Hasil affected_rows harus bernilai 1 dengan info db_size_mb
SELECT public.sync_application_data();
