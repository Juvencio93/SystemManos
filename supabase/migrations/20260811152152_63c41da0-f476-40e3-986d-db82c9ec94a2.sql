-- Migration: Reestruturação da Central Operacional IA
-- Date: 2026-08-11

-- 1. Remover tabelas antigas se existirem (limpeza para reestruturação definitiva)
DROP TABLE IF EXISTS public.operational_alerts CASCADE;
DROP TABLE IF EXISTS public.operational_analyses CASCADE;

-- 2. Criar tabela de análises operacionais
CREATE TABLE public.operational_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'concluido', 
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    metrics_snapshot JSONB,
    ai_result JSONB,
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_by UUID REFERENCES auth.users(id),
    UNIQUE(analysis_date)
);

-- 3. Criar tabela de alertas operacionais
CREATE TABLE public.operational_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
    branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
    fingerprint TEXT NOT NULL, 
    type TEXT NOT NULL, 
    severity TEXT NOT NULL, 
    title TEXT NOT NULL,
    evidence JSONB NOT NULL,
    recommendation TEXT,
    status TEXT NOT NULL DEFAULT 'aberto', 
    detected_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    contacted_at TIMESTAMP WITH TIME ZONE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    handled_by UUID REFERENCES auth.users(id),
    admin_note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 4. Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.operational_analyses TO authenticated;
GRANT ALL ON public.operational_analyses TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.operational_alerts TO authenticated;
GRANT ALL ON public.operational_alerts TO service_role;

-- 5. RLS
ALTER TABLE public.operational_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operational_alerts ENABLE ROW LEVEL SECURITY;

-- Políticas restritas ao ADM
CREATE POLICY "Apenas ADM pode ver análises"
ON public.operational_analyses FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'adm'));

CREATE POLICY "Apenas ADM pode gerenciar alertas"
ON public.operational_alerts FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'adm'));

-- 6. Índices
CREATE INDEX idx_operational_analyses_date ON public.operational_analyses(analysis_date);
CREATE INDEX idx_operational_alerts_company ON public.operational_alerts(company_id);
CREATE INDEX idx_operational_alerts_status ON public.operational_alerts(status) WHERE status != 'resolvido';
CREATE UNIQUE INDEX idx_operational_alerts_fingerprint ON public.operational_alerts(fingerprint) WHERE status != 'resolvido';

-- 7. Função RPC para Gerenciamento de Alertas (Upsert Inteligente)
CREATE OR REPLACE FUNCTION public.process_operational_alert(
    p_company_id UUID,
    p_branch_id UUID,
    p_type TEXT,
    p_severity TEXT,
    p_title TEXT,
    p_evidence JSONB,
    p_recommendation TEXT,
    p_fingerprint TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_alert_id UUID;
BEGIN
    -- Verificar se já existe um alerta aberto com esse fingerprint
    SELECT id INTO v_alert_id
    FROM public.operational_alerts
    WHERE fingerprint = p_fingerprint AND status != 'resolvido'
    LIMIT 1;

    IF v_alert_id IS NOT NULL THEN
        -- Atualizar alerta existente
        UPDATE public.operational_alerts
        SET 
            last_seen_at = now(),
            evidence = p_evidence,
            updated_at = now()
        WHERE id = v_alert_id;
    ELSE
        -- Criar novo alerta
        INSERT INTO public.operational_alerts (
            company_id, branch_id, type, severity, title, evidence, recommendation, fingerprint
        )
        VALUES (
            p_company_id, p_branch_id, p_type, p_severity, p_title, p_evidence, p_recommendation, p_fingerprint
        )
        RETURNING id INTO v_alert_id;
    END IF;

    RETURN v_alert_id;
END;
$$;
