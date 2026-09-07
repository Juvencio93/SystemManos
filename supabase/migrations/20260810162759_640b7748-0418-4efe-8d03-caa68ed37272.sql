CREATE TABLE IF NOT EXISTS public.expenses (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    description text,
    category text,
    amount numeric,
    date date,
    competence text,
    payment_method text,
    observation text,
    status text DEFAULT 'pago',
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    branch_id uuid REFERENCES public.branches(id) ON DELETE CASCADE,
    type text DEFAULT 'general',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Ensure UNIQUE constraint for charges by company and competence
-- First, clean up any existing duplicates to allow index creation
WITH duplicates AS (
    SELECT id, ROW_NUMBER() OVER(PARTITION BY company_id, competence ORDER BY created_at ASC) as rn
    FROM public.company_charges
    WHERE competence IS NOT NULL
)
DELETE FROM public.company_charges
WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);

-- Add unique constraint
ALTER TABLE public.company_charges DROP CONSTRAINT IF EXISTS company_charges_company_competence_key;
ALTER TABLE public.company_charges ADD CONSTRAINT company_charges_company_competence_key UNIQUE (company_id, competence);

-- Add unique constraints for Asaas and external IDs
ALTER TABLE public.company_charges DROP CONSTRAINT IF EXISTS company_charges_asaas_payment_id_key;
ALTER TABLE public.company_charges ADD CONSTRAINT company_charges_asaas_payment_id_key UNIQUE (asaas_payment_id);

ALTER TABLE public.company_charges DROP CONSTRAINT IF EXISTS company_charges_external_id_key;
ALTER TABLE public.company_charges ADD CONSTRAINT company_charges_external_id_key UNIQUE (external_id);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_charges TO authenticated;
GRANT ALL ON public.company_charges TO service_role;
