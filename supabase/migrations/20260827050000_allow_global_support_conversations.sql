-- Support conversations are cross-network and therefore have no company owner.
ALTER TABLE public.conversations
  ALTER COLUMN company_id DROP NOT NULL;

NOTIFY pgrst, 'reload schema';
