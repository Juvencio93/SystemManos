ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS asaas_customer_id TEXT;

COMMENT ON COLUMN public.companies.asaas_customer_id IS 'ID do cliente no sistema Asaas';

ALTER TABLE public.company_charges
ADD COLUMN IF NOT EXISTS asaas_payment_id TEXT,
ADD COLUMN IF NOT EXISTS asaas_pix_qr_code TEXT,
ADD COLUMN IF NOT EXISTS asaas_pix_copy_paste TEXT,
ADD COLUMN IF NOT EXISTS asaas_last_event_id TEXT;

COMMENT ON COLUMN public.company_charges.asaas_payment_id IS 'ID da cobrança no sistema Asaas';
COMMENT ON COLUMN public.company_charges.asaas_pix_qr_code IS 'Base64 ou URL do QR Code PIX';
COMMENT ON COLUMN public.company_charges.asaas_pix_copy_paste IS 'Código Copia e Cola do PIX';
COMMENT ON COLUMN public.company_charges.asaas_last_event_id IS 'ID do último evento processado via webhook (idempotência)';