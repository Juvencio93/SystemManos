-- Aviso de exclusão de empresa, lido pelo Hermes (sync_coleta).
-- company_id NÃO tem FK de propósito: quando o aviso é processado,
-- a empresa já foi apagada. O sync só purga os dados do Hermes se a
-- empresa não existir mais no painel (se ela ainda existir, o aviso
-- é ignorado — a exclusão não se completou).
CREATE TABLE IF NOT EXISTS public.company_deletion_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  name text NOT NULL,
  trade_name text,
  slug text,
  deleted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  processed_note text
);

CREATE INDEX IF NOT EXISTS company_deletion_notices_unprocessed_idx
  ON public.company_deletion_notices (created_at)
  WHERE processed_at IS NULL;

ALTER TABLE public.company_deletion_notices ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.company_deletion_notices TO service_role;
GRANT SELECT ON public.company_deletion_notices TO authenticated;
DROP POLICY IF EXISTS "ADM reads company deletion notices" ON public.company_deletion_notices;
CREATE POLICY "ADM reads company deletion notices"
ON public.company_deletion_notices FOR SELECT TO authenticated
USING (public.has_role((select auth.uid()), 'adm'));

-- Estorno dos créditos de revenda de uma empresa. Tem que rodar ANTES
-- de apagar a empresa: as linhas de alocação somem em cascata com ela,
-- então depois não dá mais para saber de qual lote devolver.
-- Devolve para o lote de origem de cada alocação (a reversão exata do
-- consumo). Só service_role executa; a checagem de ADM vive na função
-- do painel que chama esta RPC.
CREATE OR REPLACE FUNCTION public.reseller_refund_company_credits(p_company_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_total integer := 0;
BEGIN
  UPDATE public.reseller_credit_lots l
  SET remaining_quantity = remaining_quantity + s.qtd
  FROM (
    SELECT credit_lot_id, COUNT(*)::integer AS qtd
    FROM public.reseller_credit_allocations
    WHERE company_id = p_company_id
    GROUP BY credit_lot_id
  ) s
  WHERE l.id = s.credit_lot_id;
  SELECT COUNT(*)::integer INTO v_total
  FROM public.reseller_credit_allocations
  WHERE company_id = p_company_id;
  RETURN v_total;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reseller_refund_company_credits(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reseller_refund_company_credits(uuid) TO service_role;
