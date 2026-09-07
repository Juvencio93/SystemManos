CREATE OR REPLACE FUNCTION public.reseller_consume_credit_for_unit(
  p_reseller_id uuid,
  p_unit_type text,
  p_unit_id uuid,
  p_company_id uuid,
  p_branch_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  lot_row record;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = (SELECT auth.uid()) AND role::text = 'revenda' AND reseller_id = p_reseller_id
  ) THEN
    RAISE EXCEPTION 'Sem permissão para consumir créditos desta revenda.';
  END IF;
  IF p_unit_type NOT IN ('matriz', 'filial') THEN
    RAISE EXCEPTION 'Tipo de unidade inválido.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.reseller_credit_allocations
    WHERE reseller_id = p_reseller_id AND unit_type = p_unit_type AND unit_id = p_unit_id
      AND expires_at > now()
  ) THEN RETURN true; END IF;
  SELECT id, expires_at INTO lot_row FROM public.reseller_credit_lots
  WHERE reseller_id = p_reseller_id AND remaining_quantity > 0 AND expires_at > now()
  ORDER BY expires_at ASC, purchased_at ASC FOR UPDATE LIMIT 1;
  IF lot_row.id IS NULL THEN RETURN false; END IF;
  UPDATE public.reseller_credit_lots SET remaining_quantity = remaining_quantity - 1 WHERE id = lot_row.id;
  INSERT INTO public.reseller_credit_allocations
    (reseller_id, credit_lot_id, unit_type, unit_id, company_id, branch_id, expires_at)
  VALUES (p_reseller_id, lot_row.id, p_unit_type, p_unit_id, p_company_id, p_branch_id, lot_row.expires_at);
  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reseller_consume_credit_for_unit(uuid, text, uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reseller_consume_credit_for_unit(uuid, text, uuid, uuid, uuid) TO authenticated;
