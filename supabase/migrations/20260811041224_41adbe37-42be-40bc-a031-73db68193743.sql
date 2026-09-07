ALTER TABLE public.company_charges ADD COLUMN IF NOT EXISTS notes text;
COMMENT ON COLUMN public.company_charges.notes IS 'Observação interna registrada na confirmação manual de recebimento.';
NOTIFY pgrst, 'reload schema';