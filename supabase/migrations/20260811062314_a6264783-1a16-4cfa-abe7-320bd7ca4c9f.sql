-- Add business profile fields for AI context
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS business_segment text,
ADD COLUMN IF NOT EXISTS business_description text,
ADD COLUMN IF NOT EXISTS wifi_marketing_goal text;

-- Add comments for documentation
COMMENT ON COLUMN public.companies.business_segment IS 'Ramo de atuação da empresa para contexto da IA';
COMMENT ON COLUMN public.companies.business_description IS 'Descrição do negócio para contexto da IA (serviços, produtos, público-alve)';
COMMENT ON COLUMN public.companies.wifi_marketing_goal IS 'Objetivo principal do marketing via Wi-Fi';

-- Re-grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.companies TO authenticated;
GRANT ALL ON public.companies TO service_role;
