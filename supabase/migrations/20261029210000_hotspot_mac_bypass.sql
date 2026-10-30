-- Dispositivos liberados (MAC bypass): MACs que pulam o captive portal
-- via /ip hotspot ip-binding type=bypassed. A RB busca a lista no
-- heartbeat e aplica sozinha.
CREATE TABLE public.hotspot_mac_bypass (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE CASCADE,
  mac_address text NOT NULL,
  label text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hotspot_mac_bypass_mac_format CHECK (mac_address ~ '^([0-9A-F]{2}:){5}[0-9A-F]{2}$'),
  UNIQUE (company_id, mac_address)
);

CREATE INDEX hotspot_mac_bypass_company_idx ON public.hotspot_mac_bypass (company_id);
CREATE INDEX hotspot_mac_bypass_branch_idx ON public.hotspot_mac_bypass (branch_id);
