-- Remove policies that are exact duplicates of existing ADM policies.
DROP POLICY IF EXISTS "Admins can see all company analyses" ON public.company_operational_analyses;
DROP POLICY IF EXISTS "Admins can do everything on expenses" ON public.expenses;
DROP POLICY IF EXISTS "Apenas ADM pode ver análises" ON public.operational_analyses;

-- Cover foreign keys reported by the database advisor.
CREATE INDEX IF NOT EXISTS ai_memories_user_id_idx ON public.ai_memories (user_id);
CREATE INDEX IF NOT EXISTS chat_attachments_message_id_idx ON public.chat_attachments (message_id);
CREATE INDEX IF NOT EXISTS chat_reactions_user_id_idx ON public.chat_reactions (user_id);
CREATE INDEX IF NOT EXISTS company_charges_reseller_id_idx ON public.company_charges (reseller_id);
CREATE INDEX IF NOT EXISTS connections_event_id_idx ON public.connections (event_id);
CREATE INDEX IF NOT EXISTS connections_reseller_id_idx ON public.connections (reseller_id);
CREATE INDEX IF NOT EXISTS conversation_participants_profile_id_idx ON public.conversation_participants (profile_id);
CREATE INDEX IF NOT EXISTS events_company_id_idx ON public.events (company_id);
CREATE INDEX IF NOT EXISTS events_reseller_id_idx ON public.events (reseller_id);
CREATE INDEX IF NOT EXISTS expenses_branch_id_idx ON public.expenses (branch_id);
CREATE INDEX IF NOT EXISTS image_generations_branch_id_idx ON public.image_generations (branch_id);
CREATE INDEX IF NOT EXISTS image_generations_company_id_idx ON public.image_generations (company_id);
CREATE INDEX IF NOT EXISTS messages_sender_id_idx ON public.messages (sender_id);
CREATE INDEX IF NOT EXISTS operational_ai_messages_user_id_idx ON public.operational_ai_messages (user_id);
CREATE INDEX IF NOT EXISTS operational_alerts_branch_id_idx ON public.operational_alerts (branch_id);
CREATE INDEX IF NOT EXISTS operational_alerts_handled_by_idx ON public.operational_alerts (handled_by);
CREATE INDEX IF NOT EXISTS operational_analyses_created_by_idx ON public.operational_analyses (created_by);
CREATE INDEX IF NOT EXISTS reseller_credit_allocations_branch_id_idx ON public.reseller_credit_allocations (branch_id);
CREATE INDEX IF NOT EXISTS reseller_credit_allocations_company_id_idx ON public.reseller_credit_allocations (company_id);
CREATE INDEX IF NOT EXISTS reseller_credit_allocations_credit_lot_id_idx ON public.reseller_credit_allocations (credit_lot_id);
CREATE INDEX IF NOT EXISTS reseller_credit_lots_created_by_idx ON public.reseller_credit_lots (created_by);
CREATE INDEX IF NOT EXISTS reseller_credit_orders_created_by_idx ON public.reseller_credit_orders (created_by);
CREATE INDEX IF NOT EXISTS user_roles_branch_id_idx ON public.user_roles (branch_id);
CREATE INDEX IF NOT EXISTS user_roles_company_id_idx ON public.user_roles (company_id);

-- These RPCs remain callable by authenticated users because the application uses them.
-- Validate the authenticated subject before using caller-supplied identifiers.
CREATE OR REPLACE FUNCTION public.get_ai_limits_distribution(_company_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  total_limit integer;
  matriz_limit integer := 10;
  pool_filiais integer;
  active_filiais_count integer;
  filial_limit integer := 0;
  bonus_limit integer := 0;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'adm') AND NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND company_id = _company_id
  ) THEN
    RAISE EXCEPTION 'Sem permissão para consultar os limites desta empresa.';
  END IF;

  SELECT ai_daily_command_limit INTO total_limit FROM public.companies WHERE id = _company_id;
  IF total_limit IS NULL THEN total_limit := 20; END IF;
  pool_filiais := greatest(total_limit - matriz_limit, 0);

  SELECT count(*)::integer INTO active_filiais_count
  FROM public.branches
  WHERE company_id = _company_id AND active = true AND is_headquarters = false;

  IF active_filiais_count > 0 THEN
    filial_limit := pool_filiais / active_filiais_count;
    bonus_limit := pool_filiais % active_filiais_count;
  END IF;

  RETURN json_build_object(
    'total_limit', total_limit, 'matriz_limit', matriz_limit,
    'pool_filiais', pool_filiais, 'active_filiais_count', active_filiais_count,
    'filial_limit', filial_limit, 'bonus_limit', bonus_limit
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_ai_usage_safe(
  _user_id uuid, _company_id uuid, _branch_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_role public.app_role;
  v_branch_id uuid;
  v_limit_dist json;
  v_current_usage integer;
  v_limit integer;
  v_all_filiais_usage integer;
  v_pool_filiais integer;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() IS DISTINCT FROM _user_id THEN
    RETURN json_build_object('allowed', false, 'error', 'Acesso negado.');
  END IF;

  SELECT role, branch_id INTO v_role, v_branch_id
  FROM public.user_roles
  WHERE user_id = _user_id AND company_id = _company_id;
  IF NOT FOUND THEN RETURN json_build_object('allowed', false, 'error', 'Acesso negado.'); END IF;

  v_limit_dist := public.get_ai_limits_distribution(_company_id);
  IF v_role = 'matriz' THEN
    v_limit := (v_limit_dist->>'matriz_limit')::integer;
    SELECT ai_usage_today INTO v_current_usage FROM public.companies WHERE id = _company_id FOR UPDATE;
    IF v_current_usage >= v_limit THEN
      RETURN json_build_object('allowed', false, 'error', 'Limite diário de consultas IA atingido para a Matriz.');
    END IF;
    UPDATE public.companies SET ai_usage_today = ai_usage_today + 1 WHERE id = _company_id;
    RETURN json_build_object('allowed', true, 'error', null);
  ELSIF v_role = 'filial' THEN
    IF v_branch_id IS DISTINCT FROM _branch_id THEN
      RETURN json_build_object('allowed', false, 'error', 'Contexto de unidade inválido.');
    END IF;
    v_limit := (v_limit_dist->>'filial_limit')::integer;
    v_pool_filiais := (v_limit_dist->>'pool_filiais')::integer;
    SELECT ai_usage_today INTO v_current_usage FROM public.branches WHERE id = v_branch_id FOR UPDATE;
    IF v_current_usage < v_limit THEN
      UPDATE public.branches SET ai_usage_today = ai_usage_today + 1 WHERE id = v_branch_id;
      RETURN json_build_object('allowed', true, 'error', null);
    END IF;
    IF (v_limit_dist->>'bonus_limit')::integer > 0 THEN
      SELECT coalesce(sum(ai_usage_today), 0)::integer INTO v_all_filiais_usage
      FROM public.branches
      WHERE company_id = _company_id AND active = true AND is_headquarters = false;
      IF v_all_filiais_usage < v_pool_filiais THEN
        UPDATE public.branches SET ai_usage_today = ai_usage_today + 1 WHERE id = v_branch_id;
        RETURN json_build_object('allowed', true, 'error', null);
      END IF;
    END IF;
    RETURN json_build_object('allowed', false, 'error', 'Limite diário de consultas IA atingido para sua unidade.');
  END IF;
  RETURN json_build_object('allowed', true, 'error', null);
END;
$$;

CREATE OR REPLACE FUNCTION public.reseller_consume_credit_for_unit(
  p_reseller_id uuid, p_unit_type text, p_unit_id uuid, p_company_id uuid, p_branch_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE lot_row record;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role::text = 'revenda' AND reseller_id = p_reseller_id
  ) THEN RAISE EXCEPTION 'Sem permissão para consumir créditos desta revenda.'; END IF;
  IF p_unit_type NOT IN ('matriz', 'filial') THEN RAISE EXCEPTION 'Tipo de unidade inválido.'; END IF;
  IF p_unit_type = 'matriz' AND NOT EXISTS (
    SELECT 1 FROM public.companies WHERE id = p_unit_id AND id = p_company_id AND reseller_id = p_reseller_id
  ) THEN RAISE EXCEPTION 'Unidade inválida para esta revenda.'; END IF;
  IF p_unit_type = 'filial' AND NOT EXISTS (
    SELECT 1 FROM public.branches b JOIN public.companies c ON c.id = b.company_id
    WHERE b.id = p_unit_id AND b.id = p_branch_id AND b.company_id = p_company_id AND c.reseller_id = p_reseller_id
  ) THEN RAISE EXCEPTION 'Unidade inválida para esta revenda.'; END IF;
  IF EXISTS (SELECT 1 FROM public.reseller_credit_allocations WHERE reseller_id = p_reseller_id AND unit_type = p_unit_type AND unit_id = p_unit_id AND expires_at > now()) THEN RETURN true; END IF;
  SELECT id, expires_at INTO lot_row FROM public.reseller_credit_lots WHERE reseller_id = p_reseller_id AND remaining_quantity > 0 AND expires_at > now() ORDER BY expires_at ASC, purchased_at ASC FOR UPDATE LIMIT 1;
  IF lot_row.id IS NULL THEN RETURN false; END IF;
  UPDATE public.reseller_credit_lots SET remaining_quantity = remaining_quantity - 1 WHERE id = lot_row.id;
  INSERT INTO public.reseller_credit_allocations (reseller_id, credit_lot_id, unit_type, unit_id, company_id, branch_id, expires_at) VALUES (p_reseller_id, lot_row.id, p_unit_type, p_unit_id, p_company_id, p_branch_id, lot_row.expires_at);
  RETURN true;
END;
$$;

ALTER FUNCTION public.reseller_refresh_credit_coverage(uuid) SET search_path = pg_catalog, public;
REVOKE ALL ON FUNCTION public.get_ai_limits_distribution(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.increment_ai_usage_safe(uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reseller_consume_credit_for_unit(uuid, text, uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_ai_limits_distribution(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.increment_ai_usage_safe(uuid, uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reseller_consume_credit_for_unit(uuid, text, uuid, uuid, uuid) TO authenticated, service_role;
