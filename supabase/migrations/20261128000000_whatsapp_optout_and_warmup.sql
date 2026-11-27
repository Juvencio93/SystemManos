-- PR #232 — Item 2 (parte 1): opt-out auditável + maturidade da instância (warm-up).
--
-- Corrige um bug silencioso: o webhook antigo gravava `marketing_consent_revoked_at`,
-- coluna que nunca existiu em nenhuma migration (o update falhava no PostgREST).
-- As colunas novas abaixo substituem ela.
--
-- O teto diário do worker NÃO muda nesta PR: continua 20/dia na 1ª semana e
-- 30/dia depois (limiteDiario em scripts/whatsapp-worker.mjs). A coluna
-- `first_connected_at` é só o registro preciso da maturidade, para uso futuro.

-- 1. Auditoria de opt-out em visitors.
ALTER TABLE public.visitors
  ADD COLUMN IF NOT EXISTS marketing_opt_out_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS marketing_opt_out_reason text NULL;

COMMENT ON COLUMN public.visitors.marketing_opt_out_at IS 'Quando o visitante pediu para sair (SAIR/PARAR/CANCELAR/DESCADASTRAR via WhatsApp).';
COMMENT ON COLUMN public.visitors.marketing_opt_out_reason IS 'Origem do opt-out (ex.: whatsapp_keyword).';

-- 2. Maturidade da instância (warm-up) em whatsapp_instancias.
ALTER TABLE public.whatsapp_instancias
  ADD COLUMN IF NOT EXISTS first_connected_at timestamptz NULL;

-- Backfill: preserva a data real de início de aquecimento / primeira conexão.
UPDATE public.whatsapp_instancias
SET first_connected_at = COALESCE(aquecimento_inicio, conectada_em, created_at, now())
WHERE first_connected_at IS NULL;

-- Trigger: preenche first_connected_at na primeira conexão da instância.
CREATE OR REPLACE FUNCTION public.set_whatsapp_instancia_first_connected()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'conectada' AND NEW.first_connected_at IS NULL THEN
    NEW.first_connected_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_whatsapp_instancia_first_connected ON public.whatsapp_instancias;
CREATE TRIGGER trg_whatsapp_instancia_first_connected
  BEFORE INSERT OR UPDATE ON public.whatsapp_instancias
  FOR EACH ROW EXECUTE FUNCTION public.set_whatsapp_instancia_first_connected();
