ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS ai_insights_cache JSONB,
ADD COLUMN IF NOT EXISTS ai_insights_updated_at TIMESTAMPTZ;

COMMENT ON COLUMN public.companies.ai_insights_cache IS 'Cache for AI generated alerts and recommendations';
COMMENT ON COLUMN public.companies.ai_insights_updated_at IS 'Last time the AI insights were updated';