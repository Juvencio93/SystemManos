-- Add portal_slug to companies table
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS portal_slug TEXT UNIQUE;

-- Backfill portal_slug from branches where is_headquarters = true
UPDATE public.companies c
SET portal_slug = b.portal_slug
FROM public.branches b
WHERE b.company_id = c.id AND b.is_headquarters = true;

-- Note: We keep the column in branches for now to avoid breaking other logic, 
-- but the single source of truth for the Matriz portal will be the company record.
