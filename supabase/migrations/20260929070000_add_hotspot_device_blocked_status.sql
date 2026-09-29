ALTER TABLE public.hotspot_devices DROP CONSTRAINT IF EXISTS hotspot_devices_status_check;
ALTER TABLE public.hotspot_devices ADD CONSTRAINT hotspot_devices_status_check CHECK (
  status IN ('awaiting_provisioning', 'awaiting_homologation', 'operational', 'blocked', 'suspended', 'error')
);
