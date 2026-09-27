CREATE OR REPLACE FUNCTION public.upsert_operational_alert(
    p_company_id UUID,
    p_branch_id UUID,
    p_severity TEXT,
    p_reason TEXT,
    p_metrics JSONB
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.operational_alerts (
        company_id, 
        branch_id, 
        severity, 
        reason, 
        metrics_snapshot, 
        last_detected_at,
        status
    )
    VALUES (
        p_company_id, 
        p_branch_id, 
        p_severity, 
        p_reason, 
        p_metrics, 
        now(),
        'aberto'
    )
    ON CONFLICT (company_id, branch_id) DO UPDATE
    SET 
        severity = p_severity,
        reason = p_reason,
        metrics_snapshot = p_metrics,
        last_detected_at = now(),
        status = CASE 
            WHEN public.operational_alerts.status = 'resolvido' THEN 'aberto' 
            ELSE public.operational_alerts.status 
        END;
END;
$$;

-- Garantir que a constraint única exista para o UPSERT funcionar por par empresa/filial
-- Nota: se não houver branch_id, consideramos a Matriz (NULL no branch_id)
-- PostgreSQL trata NULLs como valores distintos em constraints únicas, 
-- então precisamos de um índice parcial ou tratar branch_id nulo.
DROP INDEX IF EXISTS idx_operational_alerts_unique_target;
CREATE UNIQUE INDEX idx_operational_alerts_unique_target ON public.operational_alerts (company_id, COALESCE(branch_id, '00000000-0000-0000-0000-000000000000'::uuid));

GRANT EXECUTE ON FUNCTION public.upsert_operational_alert TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_operational_alert TO service_role;
