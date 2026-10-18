-- Cota leve para turnos de pergunta do Manos Tech IA (gerador de banners).
-- Gerações finais continuam na cota principal (10/dia); perguntas usam
-- contador próprio (30/dia) para não permitir conversa ilimitada gratuita.

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS ai_questions_today integer NOT NULL DEFAULT 0;

ALTER TABLE public.branches
  ADD COLUMN IF NOT EXISTS ai_questions_today integer NOT NULL DEFAULT 0;

-- Estende o reset diário existente para zerar também os contadores de perguntas.
-- Reexecuta a lógica de data do reset_daily_ai_usage para companies e branches.
CREATE OR REPLACE FUNCTION public.reset_daily_ai_usage()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    today_sp date;
BEGIN
    -- Obter a data atual em São Paulo (mesma lógica da função original)
    today_sp := (now() AT TIME ZONE 'America/Sao_Paulo')::date;

    -- Reset para Filiais (branches)
    UPDATE public.branches
    SET ai_usage_today = 0,
        ai_questions_today = 0,
        ai_usage_last_reset_at = now()
    WHERE (ai_usage_last_reset_at AT TIME ZONE 'America/Sao_Paulo')::date < today_sp;

    -- Reset para Matrizes (companies)
    UPDATE public.companies
    SET ai_usage_today = 0,
        ai_questions_today = 0,
        ai_usage_last_reset_at = now()
    WHERE (ai_usage_last_reset_at AT TIME ZONE 'America/Sao_Paulo')::date < today_sp;
END;
$$;

-- Débito atômico com trava de linha, espelhando increment_ai_usage_safe.
-- Limite: 30 perguntas/dia por empresa (matriz) ou por filial.
CREATE OR REPLACE FUNCTION public.increment_ai_question_usage_safe(_user_id uuid, _company_id uuid, _branch_id uuid DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_role public.app_role;
    v_company_id uuid;
    v_branch_id uuid;
    v_current integer;
    v_limit constant integer := 30;
BEGIN
    SELECT role, company_id, branch_id INTO v_role, v_company_id, v_branch_id
    FROM public.user_roles
    WHERE user_id = _user_id AND company_id = _company_id;

    IF NOT FOUND THEN
        RETURN json_build_object('allowed', false, 'error', 'Acesso negado.');
    END IF;

    IF v_role = 'matriz' THEN
        SELECT ai_questions_today INTO v_current
        FROM public.companies
        WHERE id = _company_id
        FOR UPDATE;

        IF v_current >= v_limit THEN
            RETURN json_build_object('allowed', false, 'error', 'Limite diário de perguntas à IA atingido. Tente novamente amanhã.');
        END IF;

        UPDATE public.companies
        SET ai_questions_today = ai_questions_today + 1
        WHERE id = _company_id;

        RETURN json_build_object('allowed', true, 'error', null);
    ELSIF v_role = 'filial' THEN
        IF v_branch_id IS DISTINCT FROM _branch_id THEN
            RETURN json_build_object('allowed', false, 'error', 'Contexto de unidade inválido.');
        END IF;

        SELECT ai_questions_today INTO v_current
        FROM public.branches
        WHERE id = v_branch_id
        FOR UPDATE;

        IF v_current >= v_limit THEN
            RETURN json_build_object('allowed', false, 'error', 'Limite diário de perguntas à IA atingido para sua unidade. Tente novamente amanhã.');
        END IF;

        UPDATE public.branches
        SET ai_questions_today = ai_questions_today + 1
        WHERE id = v_branch_id;

        RETURN json_build_object('allowed', true, 'error', null);
    ELSE
        RETURN json_build_object('allowed', true, 'error', null);
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_ai_question_usage_safe(uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_ai_question_usage_safe(uuid, uuid, uuid) TO service_role;
