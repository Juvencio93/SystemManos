CREATE TABLE public.campaign_sponsors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  logo_path TEXT,
  banner_path TEXT,
  link_url TEXT,
  display_type TEXT NOT NULL DEFAULT 'logo' CHECK (display_type IN ('logo','banner')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX campaign_sponsors_campaign_idx ON public.campaign_sponsors (campaign_id, sort_order);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_sponsors TO authenticated;
GRANT ALL ON public.campaign_sponsors TO service_role;

ALTER TABLE public.campaign_sponsors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "campaign_sponsors_adm_all" ON public.campaign_sponsors FOR ALL TO authenticated
  USING (public.is_adm()) WITH CHECK (public.is_adm());

CREATE POLICY "campaign_sponsors_matriz_all" ON public.campaign_sponsors FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_id AND public.is_matriz_of(c.company_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_id AND public.is_matriz_of(c.company_id)));

CREATE POLICY "campaign_sponsors_filial_all" ON public.campaign_sponsors FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_id AND c.branch_id IS NOT NULL AND public.is_branch_user_of(c.branch_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_id AND c.branch_id IS NOT NULL AND public.is_branch_user_of(c.branch_id)));