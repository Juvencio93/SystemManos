CREATE OR REPLACE FUNCTION public.ensure_company_portal_slug()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.portal_slug IS NULL THEN
    NEW.portal_slug := LOWER(REGEXP_REPLACE(COALESCE(NEW.trade_name, NEW.name), '[^a-zA-Z0-9]', '-', 'g')) || '-' || SUBSTR(gen_random_uuid()::text, 1, 4);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_ensure_company_portal_slug ON public.companies;
CREATE TRIGGER tr_ensure_company_portal_slug
BEFORE INSERT OR UPDATE OF name, trade_name ON public.companies
FOR EACH ROW
EXECUTE FUNCTION public.ensure_company_portal_slug();
