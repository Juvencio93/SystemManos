ALTER TABLE public.campaigns DROP CONSTRAINT IF EXISTS campaign_context_check;
ALTER TABLE public.campaigns ADD CONSTRAINT campaign_context_check CHECK (
  (branch_id IS NULL AND event_id IS NULL) OR
  (branch_id IS NOT NULL AND event_id IS NULL) OR
  (branch_id IS NULL AND event_id IS NOT NULL)
);