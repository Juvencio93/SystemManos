-- Backfill pontual: garante filial-sede para empresas que já existiam
-- antes da criação automática (trigger da migration seguinte).
INSERT INTO public.branches (company_id, name, portal_slug, is_headquarters, active, daily_reset_time)
SELECT id, name, slug || '-matriz', true, true, '07:50'
FROM public.companies
WHERE NOT EXISTS (
  SELECT 1 FROM public.branches WHERE company_id = companies.id AND is_headquarters = true
);
