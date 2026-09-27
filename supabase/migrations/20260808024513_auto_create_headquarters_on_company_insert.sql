-- Garante que nenhuma empresa fique sem sede, não importa quem/o que a criou
CREATE OR REPLACE FUNCTION public.create_headquarters_branch()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.branches WHERE company_id = NEW.id AND is_headquarters = true
  ) THEN
    INSERT INTO public.branches (company_id, name, portal_slug, is_headquarters, active, daily_reset_time)
    VALUES (NEW.id, NEW.name, NEW.slug || '-matriz', true, true, '07:50');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER companies_create_headquarters
AFTER INSERT ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.create_headquarters_branch();

-- Trava extra: impede duas sedes pra mesma empresa, não importa a origem
CREATE UNIQUE INDEX branches_one_headquarters_per_company
  ON public.branches (company_id) WHERE is_headquarters = true;

REVOKE EXECUTE ON FUNCTION public.create_headquarters_branch() FROM PUBLIC, anon, authenticated;
