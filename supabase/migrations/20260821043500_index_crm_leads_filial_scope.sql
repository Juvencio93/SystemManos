create index crm_leads_source_branch_campaign_idx
  on public.crm_leads (source_branch_id, campaign_id, created_at desc)
  where source_branch_id is not null;
