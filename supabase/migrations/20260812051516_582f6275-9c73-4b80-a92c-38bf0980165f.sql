
-- Migration authorized by user request
-- Purpose: Add AI usage tracking to companies table for Matrizes and update daily reset logic.

-- 1. Add AI usage columns to public.companies if they don't exist
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS ai_usage_today integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS ai_usage_last_reset_at timestamptz NOT NULL DEFAULT now();

COMMENT ON COLUMN public.companies.ai_usage_today IS 'Daily AI command consumption for the Matriz (HQ)';
COMMENT ON COLUMN public.companies.ai_usage_last_reset_at IS 'Last time the daily consumption was reset for the Matriz';

-- 2. Update reset_daily_ai_usage to handle both companies (Matrizes) and branches (Filiais)
-- Using deterministic America/Sao_Paulo comparison as requested
CREATE OR REPLACE FUNCTION public.reset_daily_ai_usage()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    today_sp date;
BEGIN
    -- Obter a data atual em São Paulo
    today_sp := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
    
    -- Reset para Filiais (branches)
    UPDATE public.branches
    SET ai_usage_today = 0,
        ai_usage_last_reset_at = now()
    WHERE (ai_usage_last_reset_at AT TIME ZONE 'America/Sao_Paulo')::date < today_sp;

    -- Reset para Matrizes (companies)
    UPDATE public.companies
    SET ai_usage_today = 0,
        ai_usage_last_reset_at = now()
    WHERE (ai_usage_last_reset_at AT TIME ZONE 'America/Sao_Paulo')::date < today_sp;
END;
$$;

-- 3. Create a safe atomic increment function to avoid race conditions
-- This function verifies the role and limit before incrementing
CREATE OR REPLACE FUNCTION public.increment_ai_usage_safe(_user_id uuid, _company_id uuid, _branch_id uuid DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_role public.app_role;
    v_company_id uuid;
    v_branch_id uuid;
    v_limit_dist json;
    v_current_usage integer;
    v_limit integer;
    v_is_matriz boolean;
    v_all_filiais_usage integer;
    v_pool_filiais integer;
BEGIN
    -- 1. Validar o acesso do usuário
    SELECT role, company_id, branch_id INTO v_role, v_company_id, v_branch_id
    FROM public.user_roles
    WHERE user_id = _user_id AND company_id = _company_id;

    IF NOT FOUND THEN
        RETURN json_build_object('allowed', false, 'error', 'Acesso negado.');
    END IF;

    -- 2. Obter limites
    v_limit_dist := public.get_ai_limits_distribution(_company_id);
    
    IF v_role = 'matriz' THEN
        v_is_matriz := true;
        v_limit := (v_limit_dist->>'matriz_limit')::integer;
        
        -- Lock row to prevent race conditions
        SELECT ai_usage_today INTO v_current_usage
        FROM public.companies
        WHERE id = _company_id
        FOR UPDATE;

        IF v_current_usage >= v_limit THEN
            RETURN json_build_object('allowed', false, 'error', 'Limite diário de consultas IA atingido para a Matriz.');
        END IF;

        UPDATE public.companies
        SET ai_usage_today = ai_usage_today + 1
        WHERE id = _company_id;

        RETURN json_build_object('allowed', true, 'error', null);
        
    ELSIF v_role = 'filial' THEN
        v_is_matriz := false;
        -- Garantir que o branch_id fornecido é o do usuário
        IF v_branch_id IS DISTINCT FROM _branch_id THEN
            RETURN json_build_object('allowed', false, 'error', 'Contexto de unidade inválido.');
        END IF;

        v_limit := (v_limit_dist->>'filial_limit')::integer;
        v_pool_filiais := (v_limit_dist->>'pool_filiais')::integer;

        -- Lock branch row
        SELECT ai_usage_today INTO v_current_usage
        FROM public.branches
        WHERE id = v_branch_id
        FOR UPDATE;

        -- Check if within individual limit
        IF v_current_usage < v_limit THEN
            UPDATE public.branches
            SET ai_usage_today = ai_usage_today + 1
            WHERE id = v_branch_id;
            RETURN json_build_object('allowed', true, 'error', null);
        END IF;

        -- Check shared pool bonus
        IF (v_limit_dist->>'bonus_limit')::integer > 0 THEN
            SELECT sum(ai_usage_today)::integer INTO v_all_filiais_usage
            FROM public.branches
            WHERE company_id = _company_id 
              AND active = true 
              AND is_headquarters = false;

            IF v_all_filiais_usage < v_pool_filiais THEN
                UPDATE public.branches
                SET ai_usage_today = ai_usage_today + 1
                WHERE id = v_branch_id;
                RETURN json_build_object('allowed', true, 'error', null);
            END IF;
        END IF;

        RETURN json_build_object('allowed', false, 'error', 'Limite diário de consultas IA atingido para sua unidade.');
    ELSE
        -- ADM ou outros papéis sem limite rígido via esta função
        RETURN json_build_object('allowed', true, 'error', null);
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_ai_usage_safe(uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_ai_usage_safe(uuid, uuid, uuid) TO service_role;
