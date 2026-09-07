CREATE TABLE public.company_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  reference text NOT NULL DEFAULT 'Mensalidade',
  amount numeric NOT NULL DEFAULT 0,
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'pendente',
  paid_at timestamp with time zone,
  method text,
  external_id text,
  pix_payload text,
  receipt_code text NOT NULL DEFAULT concat('MT-', to_char(now(), 'YYYYMMDD'), '-', substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT company_charges_status_check CHECK (status IN ('pendente', 'pago', 'atrasado', 'cancelado'))
);

CREATE INDEX company_charges_company_due_idx ON public.company_charges (company_id, due_date DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_charges TO authenticated;
GRANT ALL ON public.company_charges TO service_role;

ALTER TABLE public.company_charges ENABLE ROW LEVEL SECURITY;

CREATE POLICY company_charges_adm_all ON public.company_charges
  FOR ALL TO authenticated USING (public.is_adm()) WITH CHECK (public.is_adm());

CREATE POLICY company_charges_matriz_read ON public.company_charges
  FOR SELECT TO authenticated USING (public.is_matriz_of(company_id));

CREATE TRIGGER company_charges_set_updated_at
  BEFORE UPDATE ON public.company_charges
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();