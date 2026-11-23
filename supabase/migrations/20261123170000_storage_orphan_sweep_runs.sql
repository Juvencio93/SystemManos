-- Varredura periódica de órfãos do Storage (Frente 7, 23/11/2026).
--
-- A tabela registra cada execução da varredura (`GET
-- /api/public/storage-orphan-sweep`, cron semanal da Vercel): quando
-- rodou, em que modo (dry-run ou live), quantos objetos e bytes havia
-- por bucket, quantos órfãos foram achados, quantos foram apagados e
-- quantos ficaram de fora por serem novos demais. É a trilha que prova
-- que o job rodou — e que prova que ele NÃO apagou nada enquanto
-- estiver em dry-run.
--
-- COMO APLICAR (Gabriel): Supabase Dashboard → SQL Editor → colar este
-- arquivo inteiro → Run. Depois conferir com:
--   SELECT id FROM storage_orphan_sweep_runs LIMIT 1;
-- (tabela vazia até a primeira varredura — o esperado é "Success. No
-- rows returned".)
CREATE TABLE IF NOT EXISTS public.storage_orphan_sweep_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  mode text NOT NULL CHECK (mode IN ('dry-run', 'live')),
  status text NOT NULL CHECK (status IN ('completed', 'partial', 'failed')),
  buckets jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_objects integer NOT NULL DEFAULT 0,
  total_bytes bigint NOT NULL DEFAULT 0,
  orphan_files integer NOT NULL DEFAULT 0,
  orphan_bytes bigint NOT NULL DEFAULT 0,
  deleted_files integer NOT NULL DEFAULT 0,
  deleted_bytes bigint NOT NULL DEFAULT 0,
  skipped_young_files integer NOT NULL DEFAULT 0,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS storage_orphan_sweep_runs_started_idx
  ON public.storage_orphan_sweep_runs (started_at DESC);

-- Sem políticas públicas: o acesso é só via service_role (a rota da
-- varredura), que ignora o RLS — mesmo padrão de `admin_audit_log`
-- (deny-all p/ authenticated).
ALTER TABLE public.storage_orphan_sweep_runs ENABLE ROW LEVEL SECURITY;
