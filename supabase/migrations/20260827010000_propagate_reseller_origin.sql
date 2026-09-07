-- Propaga a origem da revenda para todos os registros operacionais.
-- O vínculo da empresa continua sendo a fonte de verdade; estas colunas
-- permitem filtros rápidos no painel do ADM e auditoria sem alterar URLs.
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS reseller_id uuid REFERENCES public.resellers(id) ON DELETE SET NULL;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS reseller_id uuid REFERENCES public.resellers(id) ON DELETE SET NULL;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS reseller_id uuid REFERENCES public.resellers(id) ON DELETE SET NULL;
ALTER TABLE public.visitors ADD COLUMN IF NOT EXISTS reseller_id uuid REFERENCES public.resellers(id) ON DELETE SET NULL;
ALTER TABLE public.connections ADD COLUMN IF NOT EXISTS reseller_id uuid REFERENCES public.resellers(id) ON DELETE SET NULL;
ALTER TABLE public.company_charges ADD COLUMN IF NOT EXISTS reseller_id uuid REFERENCES public.resellers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS branches_reseller_id_idx ON public.branches(reseller_id);
CREATE INDEX IF NOT EXISTS campaigns_reseller_id_idx ON public.campaigns(reseller_id);
CREATE INDEX IF NOT EXISTS visitors_reseller_id_idx ON public.visitors(reseller_id);

UPDATE public.branches b SET reseller_id = c.reseller_id
FROM public.companies c WHERE c.id = b.company_id AND b.reseller_id IS NULL;
UPDATE public.events e SET reseller_id = c.reseller_id
FROM public.companies c WHERE c.id = e.company_id AND e.reseller_id IS NULL;
UPDATE public.campaigns x SET reseller_id = c.reseller_id
FROM public.companies c WHERE c.id = x.company_id AND x.reseller_id IS NULL;
UPDATE public.visitors v SET reseller_id = c.reseller_id
FROM public.companies c WHERE c.id = v.company_id AND v.reseller_id IS NULL;
UPDATE public.connections n SET reseller_id = c.reseller_id
FROM public.companies c WHERE c.id = n.company_id AND n.reseller_id IS NULL;
UPDATE public.company_charges h SET reseller_id = c.reseller_id
FROM public.companies c WHERE c.id = h.company_id AND h.reseller_id IS NULL;

CREATE OR REPLACE FUNCTION public.sync_reseller_origin()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_TABLE_NAME = 'branches' THEN
    SELECT c.reseller_id INTO NEW.reseller_id FROM public.companies c WHERE c.id = NEW.company_id;
  ELSE
    SELECT c.reseller_id INTO NEW.reseller_id FROM public.companies c WHERE c.id = NEW.company_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS branches_sync_reseller_origin ON public.branches;
CREATE TRIGGER branches_sync_reseller_origin BEFORE INSERT OR UPDATE OF company_id ON public.branches
FOR EACH ROW EXECUTE FUNCTION public.sync_reseller_origin();
DROP TRIGGER IF EXISTS events_sync_reseller_origin ON public.events;
CREATE TRIGGER events_sync_reseller_origin BEFORE INSERT OR UPDATE OF company_id ON public.events
FOR EACH ROW EXECUTE FUNCTION public.sync_reseller_origin();
DROP TRIGGER IF EXISTS campaigns_sync_reseller_origin ON public.campaigns;
CREATE TRIGGER campaigns_sync_reseller_origin BEFORE INSERT OR UPDATE OF company_id ON public.campaigns
FOR EACH ROW EXECUTE FUNCTION public.sync_reseller_origin();
DROP TRIGGER IF EXISTS visitors_sync_reseller_origin ON public.visitors;
CREATE TRIGGER visitors_sync_reseller_origin BEFORE INSERT OR UPDATE OF company_id ON public.visitors
FOR EACH ROW EXECUTE FUNCTION public.sync_reseller_origin();
DROP TRIGGER IF EXISTS connections_sync_reseller_origin ON public.connections;
CREATE TRIGGER connections_sync_reseller_origin BEFORE INSERT OR UPDATE OF company_id ON public.connections
FOR EACH ROW EXECUTE FUNCTION public.sync_reseller_origin();
DROP TRIGGER IF EXISTS company_charges_sync_reseller_origin ON public.company_charges;
CREATE TRIGGER company_charges_sync_reseller_origin BEFORE INSERT OR UPDATE OF company_id ON public.company_charges
FOR EACH ROW EXECUTE FUNCTION public.sync_reseller_origin();
