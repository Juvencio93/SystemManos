insert into public.crm_leads (
  company_id,
  campaign_id,
  visitor_id,
  source_branch_id,
  source_event_id,
  whatsapp_opt_in,
  created_at,
  updated_at
)
select distinct on (c.visitor_id, c.campaign_id)
  c.company_id,
  c.campaign_id,
  c.visitor_id,
  c.branch_id,
  c.event_id,
  false,
  c.created_at,
  now()
from public.connections c
order by c.visitor_id, c.campaign_id, c.created_at desc
on conflict (visitor_id, campaign_id) do nothing;
