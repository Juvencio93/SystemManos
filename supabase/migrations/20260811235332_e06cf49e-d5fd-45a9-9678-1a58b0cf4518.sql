-- Adicionando colunas para controle de atualização manual e redução de tokens
ALTER TABLE public.operational_analyses 
ADD COLUMN IF NOT EXISTS data_hash TEXT,
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'daily',
ADD COLUMN IF NOT EXISTS manual_ai_updated_at TIMESTAMP WITH TIME ZONE;

-- Adicionando colunas para a tabela individual para consistência
ALTER TABLE public.company_operational_analyses
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'daily';

COMMENT ON COLUMN public.operational_analyses.data_hash IS 'Hash determinístico dos dados para evitar chamadas redundantes à IA';
COMMENT ON COLUMN public.operational_analyses.source IS 'Origem da análise: daily ou manual';
COMMENT ON COLUMN public.operational_analyses.manual_ai_updated_at IS 'Data da última chamada manual à IA para controle de cooldown';