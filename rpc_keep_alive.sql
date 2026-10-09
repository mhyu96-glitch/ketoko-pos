-- ==============================================================================
-- KETOKO POS — SUPABASE KEEP-ALIVE RPC FUNCTION
-- Jalankan skrip ini di SQL Editor pada project Supabase Anda (quhjgsoqjcumckoshjtv)
-- agar Cloudflare Worker & Telegram Bot berstatus: ✅ Node_2: sehat
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

-- 4. Buat fungsi RPC keep-alive
CREATE OR REPLACE FUNCTION public.sync_application_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    affected_rows integer;
BEGIN
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
            'version', '2.0.0',
            'last_status', 'success'
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
        'version', '2.0.0'
    );
END;
$$;

-- 5. Berikan izin eksekusi ke anon & authenticated
REVOKE ALL ON FUNCTION public.sync_application_data() FROM public;
GRANT EXECUTE ON FUNCTION public.sync_application_data() TO anon, authenticated;

-- 6. Tes eksekusi. Hasil affected_rows harus bernilai 1
SELECT public.sync_application_data();

