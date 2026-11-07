-- Corrige a cota de perguntas de IA (30/dia): sem login, ninguém pode
-- debitar a cota de nenhuma empresa.
--
-- Problema verificado no banco em 06/11/2026: a função
-- increment_ai_question_usage_safe tinha EXECUTE concedido a anon (e a
-- PUBLIC), e o corpo não checava auth.uid(). Bastava um par
-- user_id + company_id válido para esgotar a cota da empresa.
-- A migration original (20261018030000) concedia EXECUTE só a
-- authenticated e service_role; o grant a anon não está no repo, por isso
-- a correção revoga explicitamente anon e PUBLIC.
--
-- Chamador legítimo: askBannerAgent (requireSupabaseAuth) ->
-- checkAiQuestionLimit(context.supabase, context.userId), com o cliente
-- autenticado do próprio usuário. auth.uid() é igual a _user_id no fluxo
-- normal, então a checagem não quebra o uso logado. ADM nem chega aqui:
-- checkAiQuestionLimit retorna allowed sem debitar para role adm.

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
    -- Sem login, nega. Logado como outro usuário, nega.
    -- A checagem da função irmã increment_ai_usage_safe não basta sozinha:
    -- ela só nega quando auth.uid() não é nulo e é diferente de _user_id,
    -- então anônimo passaria. Aqui a negação é estrita.
    IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM _user_id THEN
        RETURN json_build_object('allowed', false, 'error', 'Acesso negado.');
    END IF;

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

-- Anônimo nem chega a chamar a função. PUBLIC é revogado junto porque o
-- banco ao vivo também tinha EXECUTE via PUBLIC.
REVOKE EXECUTE ON FUNCTION public.increment_ai_question_usage_safe(uuid, uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.increment_ai_question_usage_safe(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_ai_question_usage_safe(uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_ai_question_usage_safe(uuid, uuid, uuid) TO service_role;
