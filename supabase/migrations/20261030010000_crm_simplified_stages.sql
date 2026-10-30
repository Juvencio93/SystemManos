-- CRM simplificado: funil de 4 etapas (opt-in = qualificação)
-- Interessado (autorizou) / Sem interesse (não autorizou) / Convertido / Não contatar

-- 1. Migrar dados existentes: preserva convertido/nao_contatar, demais pelo opt-in
UPDATE public.crm_leads
SET stage = CASE
  WHEN stage IN ('convertido', 'nao_contatar') THEN stage
  WHEN whatsapp_opt_in = true THEN 'interessado'
  ELSE 'sem_interesse'
END
WHERE stage NOT IN ('interessado', 'sem_interesse', 'convertido', 'nao_contatar');

-- 2. Remover CHECK antigo e adicionar o novo (4 etapas)
ALTER TABLE public.crm_leads
  DROP CONSTRAINT IF EXISTS crm_leads_stage_check;

ALTER TABLE public.crm_leads
  ADD CONSTRAINT crm_leads_stage_check
  CHECK (stage IN ('interessado', 'sem_interesse', 'convertido', 'nao_contatar'));

-- 3. Mudar o default para 'interessado' (o código define explicitamente, mas por segurança)
ALTER TABLE public.crm_leads
  ALTER COLUMN stage SET DEFAULT 'interessado';
