-- Tabela para armazenar análises operacionais históricas
CREATE TABLE public.operational_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    summary_ia JSONB, -- Resumo executivo e recomendações da IA
    snapshot_metrics JSONB NOT NULL, -- Métricas brutas utilizadas na análise
    indicators JSONB NOT NULL, -- KPIs superiores (empresas, destaque, atenção, crítico)
    created_by UUID REFERENCES auth.users(id)
);

-- Tabela para alertas operacionais persistentes
CREATE TABLE public.operational_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
    branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
    severity TEXT CHECK (severity IN ('critico', 'atencao', 'destaque', 'estavel', 'sem_dados')) NOT NULL,
    reason TEXT NOT NULL,
    metrics_snapshot JSONB,
    status TEXT CHECK (status IN ('aberto', 'contatado', 'resolvido')) DEFAULT 'aberto' NOT NULL,
    notes TEXT,
    detected_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    last_detected_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES auth.users(id),
    responsible_adm UUID REFERENCES auth.users(id)
);

-- Grants
GRANT SELECT, INSERT, UPDATE ON public.operational_analyses TO authenticated;
GRANT ALL ON public.operational_analyses TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.operational_alerts TO authenticated;
GRANT ALL ON public.operational_alerts TO service_role;

-- RLS
ALTER TABLE public.operational_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operational_alerts ENABLE ROW LEVEL SECURITY;

-- Apenas admins podem ver ou gerenciar estas tabelas
CREATE POLICY "Admins can manage operational_analyses" 
ON public.operational_analyses 
FOR ALL 
TO authenticated 
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage operational_alerts" 
ON public.operational_alerts 
FOR ALL 
TO authenticated 
USING (public.has_role(auth.uid(), 'admin'));

-- Índice para performance
CREATE INDEX idx_operational_alerts_company ON public.operational_alerts(company_id);
CREATE INDEX idx_operational_alerts_status ON public.operational_alerts(status);
