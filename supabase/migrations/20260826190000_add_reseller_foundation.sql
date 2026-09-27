CREATE TABLE IF NOT EXISTS public.resellers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  document text,
  contact_email text,
  contact_phone text,
  status text NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa', 'suspensa')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS reseller_id uuid REFERENCES public.resellers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS companies_reseller_id_idx ON public.companies (reseller_id);

ALTER TABLE public.resellers ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.resellers TO authenticated;
GRANT ALL ON public.resellers TO service_role;

DROP POLICY IF EXISTS "ADM manages resellers" ON public.resellers;
CREATE POLICY "ADM manages resellers"
ON public.resellers
FOR ALL
TO authenticated
USING (public.has_role((select auth.uid()), 'adm'))
WITH CHECK (public.has_role((select auth.uid()), 'adm'));

DROP TRIGGER IF EXISTS resellers_updated_at ON public.resellers;
CREATE TRIGGER resellers_updated_at
BEFORE UPDATE ON public.resellers
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
