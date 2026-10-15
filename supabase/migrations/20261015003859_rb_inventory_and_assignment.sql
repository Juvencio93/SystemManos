-- Hardware survives assignment changes. Existing devices keep generation zero.
ALTER TABLE public.hotspot_devices
  ALTER COLUMN company_id DROP NOT NULL,
  ALTER COLUMN hotspot_config_id DROP NOT NULL,
  ADD COLUMN inventory_label text,
  ADD COLUMN inventory_reseller_id uuid REFERENCES public.resellers(id) ON DELETE RESTRICT,
  ADD COLUMN assignment_version integer NOT NULL DEFAULT 0 CHECK (assignment_version >= 0),
  ADD COLUMN credential_version integer NOT NULL DEFAULT 0,
  ADD COLUMN assignment_applied_version integer DEFAULT 0,
  ADD COLUMN assignment_requested_at timestamptz,
  ADD COLUMN assignment_applied_at timestamptz,
  ADD COLUMN verification_expires_at timestamptz;

ALTER TABLE public.hotspot_devices DROP CONSTRAINT hotspot_devices_company_id_fkey,
  DROP CONSTRAINT hotspot_devices_branch_id_fkey, DROP CONSTRAINT hotspot_devices_hotspot_config_id_fkey,
  ADD FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE RESTRICT,
  ADD FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE RESTRICT,
  ADD FOREIGN KEY (hotspot_config_id) REFERENCES public.hotspot_configs(id) ON DELETE RESTRICT;
ALTER TABLE public.hotspot_devices DROP CONSTRAINT hotspot_devices_status_check;
ALTER TABLE public.hotspot_devices ADD CONSTRAINT hotspot_devices_status_check CHECK
  (status IN ('stock','transfer_pending','verifying','awaiting_provisioning','awaiting_homologation','operational','suspended','error','blocked'));
UPDATE public.hotspot_devices d SET inventory_reseller_id = coalesce(b.reseller_id,c.reseller_id)
  FROM public.companies c LEFT JOIN public.branches b ON b.company_id=c.id
  WHERE d.company_id=c.id AND (d.branch_id=b.id OR (d.branch_id IS NULL AND b.id IS NULL));
UPDATE public.hotspot_devices d SET inventory_reseller_id=c.reseller_id
  FROM public.companies c WHERE d.company_id=c.id AND d.branch_id IS NULL;

ALTER TABLE public.hotspot_access_grants ADD COLUMN device_id uuid REFERENCES public.hotspot_devices(id) ON DELETE RESTRICT,
  ADD COLUMN assignment_version integer;
ALTER TABLE public.hotspot_access_grants DROP CONSTRAINT hotspot_access_grants_pending_or_finalized_chk;
ALTER TABLE public.hotspot_access_grants ADD CONSTRAINT hotspot_access_grants_pending_or_finalized_chk
  CHECK (pending_checkin IS NOT NULL OR visitor_id IS NOT NULL OR revoked_at IS NOT NULL);
ALTER TABLE public.hotspot_portal_handoffs ADD COLUMN device_id uuid REFERENCES public.hotspot_devices(id) ON DELETE RESTRICT,
  ADD COLUMN assignment_version integer;
CREATE INDEX hotspot_grants_device_idx ON public.hotspot_access_grants(device_id) WHERE revoked_at IS NULL;

-- Private transfer journal: never expose former tenants to a new assignee.
CREATE TABLE public.hotspot_assignment_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), device_id uuid NOT NULL REFERENCES public.hotspot_devices(id) ON DELETE RESTRICT,
  assignment_version integer NOT NULL, previous_company_id uuid, company_id uuid, branch_id uuid,
  actor_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), applied_at timestamptz,
  UNIQUE(device_id, assignment_version)
);
ALTER TABLE public.hotspot_assignment_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.hotspot_assignment_history FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.hotspot_assignment_history TO service_role;
CREATE POLICY hotspot_inventory_owner_read ON public.hotspot_devices FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id=(select auth.uid()) AND
  (r.role='adm' OR (r.role='revenda' AND r.reseller_id=inventory_reseller_id))));

-- Defense against old save/block/homologation endpoints bypassing the lifecycle.
CREATE FUNCTION public.guard_hotspot_assignment() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF NEW.router_identity IS DISTINCT FROM OLD.router_identity THEN
    RAISE EXCEPTION 'A identidade física da RB é permanente.';
  END IF;
  IF ROW(NEW.company_id,NEW.branch_id,NEW.hotspot_config_id) IS DISTINCT FROM ROW(OLD.company_id,OLD.branch_id,OLD.hotspot_config_id)
     AND NOT (NEW.assignment_version=OLD.assignment_version+1 AND NEW.status='transfer_pending' AND NEW.assignment_applied_version IS NULL) THEN
    RAISE EXCEPTION 'Use Transferir no estoque de RBs.';
  END IF;
  IF NEW.status IN ('operational','verifying') AND
    (NEW.company_id IS NULL OR NEW.hotspot_config_id IS NULL OR NEW.assignment_applied_version IS DISTINCT FROM NEW.assignment_version) THEN
    RAISE EXCEPTION 'Aguarde a confirmação da configuração pela RB.';
  END IF;
  IF OLD.status IN ('stock','transfer_pending') AND NEW.status IN ('operational','blocked','verifying')
     AND NOT (OLD.status='transfer_pending' AND NEW.status='verifying' AND
       current_setting('manos.assignment_acknowledged',true)='true') THEN
    RAISE EXCEPTION 'Conclua a atribuição antes de gerenciar o acesso.';
  END IF;
  IF OLD.status='awaiting_homologation' AND NEW.status='operational' AND NEW.assignment_version>0 THEN
    RAISE EXCEPTION 'Execute a homologação do novo vínculo.';
  END IF;
  IF OLD.status='verifying' AND NEW.status='operational' AND NEW.assignment_version>0 AND
     current_setting('manos.assignment_validated',true) IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'Aguarde um check-in RADIUS validado pela RB.';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_hotspot_assignment BEFORE UPDATE ON public.hotspot_devices
FOR EACH ROW EXECUTE FUNCTION public.guard_hotspot_assignment();
REVOKE ALL ON FUNCTION public.guard_hotspot_assignment() FROM PUBLIC,anon,authenticated;

-- Called exclusively by the authenticated server with the verified actor ID.
CREATE FUNCTION public.manage_hotspot_inventory(p_actor uuid,p_action text,p_device uuid DEFAULT NULL,
  p_version integer DEFAULT NULL,p_config uuid DEFAULT NULL,p_label text DEFAULT NULL,p_identity text DEFAULT NULL,p_owner uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE d public.hotspot_devices; c public.hotspot_configs; admin_user boolean; owner_id uuid; target_owner uuid;
BEGIN
  SELECT EXISTS(SELECT 1 FROM user_roles WHERE user_id=p_actor AND role='adm') INTO admin_user;
  SELECT reseller_id INTO owner_id FROM user_roles WHERE user_id=p_actor AND role='revenda' AND reseller_id IS NOT NULL LIMIT 1;
  IF NOT admin_user AND owner_id IS NULL THEN RAISE EXCEPTION 'Sem permissão para gerenciar estoque.'; END IF;
  IF p_action='create' THEN
    IF p_identity !~ '^MT-[A-Z0-9-]{6,48}$' OR p_identity IS NULL OR length(trim(p_label)) NOT BETWEEN 1 AND 80 OR p_label IS NULL THEN
      RAISE EXCEPTION 'Identificação inválida.';
    END IF;
    INSERT INTO hotspot_devices(router_identity,inventory_label,inventory_reseller_id,status,assignment_version,assignment_applied_version,assignment_requested_at)
    VALUES(p_identity,trim(p_label),CASE WHEN admin_user THEN NULL ELSE owner_id END,'stock',1,NULL,now()) RETURNING id INTO p_device;
    RETURN p_device;
  END IF;
  SELECT * INTO d FROM hotspot_devices WHERE id=p_device FOR UPDATE;
  IF NOT FOUND OR (NOT admin_user AND d.inventory_reseller_id IS DISTINCT FROM owner_id) THEN RAISE EXCEPTION 'RB indisponível.'; END IF;
  IF d.assignment_version IS DISTINCT FROM p_version THEN RAISE EXCEPTION 'A RB foi alterada. Atualize a tela.'; END IF;
  IF p_action='verify' THEN
    IF NOT (d.status='awaiting_homologation' OR (d.status='verifying' AND d.verification_expires_at<=now())) OR d.assignment_applied_version IS DISTINCT FROM d.assignment_version OR
      d.last_seen_at IS NULL OR d.last_seen_at<now()-interval '30 seconds' THEN RAISE EXCEPTION 'A RB deve estar online e com a configuração confirmada.'; END IF;
    UPDATE hotspot_devices SET status='verifying',verification_expires_at=now()+interval '10 minutes',updated_at=now() WHERE id=d.id;
    RETURN d.id;
  END IF;
  IF p_action NOT IN ('transfer','allocate') OR d.status='suspended' THEN RAISE EXCEPTION 'Operação indisponível.'; END IF;
  IF p_action='allocate' THEN
    IF NOT admin_user OR p_owner IS NULL OR NOT EXISTS(SELECT 1 FROM resellers WHERE id=p_owner) THEN RAISE EXCEPTION 'Apenas o administrador distribui RBs entre revendas.'; END IF;
    p_config := NULL;
  END IF;
  IF d.status='transfer_pending' THEN RAISE EXCEPTION 'Aguarde a RB confirmar a transferência em andamento.'; END IF;
  IF p_config IS NOT NULL THEN
    SELECT * INTO c FROM hotspot_configs WHERE id=p_config FOR UPDATE;
    IF NOT FOUND OR c.vendor::text NOT IN ('mikrotik','mikrotik_hotspot') THEN RAISE EXCEPTION 'Salve uma configuração MikroTik no destino.'; END IF;
    SELECT coalesce(b.reseller_id,co.reseller_id) INTO target_owner FROM companies co LEFT JOIN branches b ON b.id=c.branch_id WHERE co.id=c.company_id;
    IF NOT admin_user AND target_owner IS DISTINCT FROM owner_id THEN RAISE EXCEPTION 'Destino fora da sua revenda.'; END IF;
    IF EXISTS(SELECT 1 FROM hotspot_devices WHERE hotspot_config_id=p_config AND id<>d.id) THEN RAISE EXCEPTION 'O destino já possui uma RB. Devolva-a ao estoque primeiro.'; END IF;
  END IF;
  -- Cancel old grants, including credentials issued by older application versions.
  UPDATE hotspot_access_grants SET revoked_at=now(),pending_checkin=NULL WHERE revoked_at IS NULL AND
    (device_id=d.id OR (device_id IS NULL AND company_id=d.company_id AND portal_target_id=coalesce(d.branch_id,d.company_id)));
  DELETE FROM hotspot_portal_handoffs WHERE device_id=d.id OR router_identity=d.router_identity;
  UPDATE hotspot_configs SET status='awaiting_homologation',is_active=false,ap_mac=NULL,updated_at=now() WHERE id=d.hotspot_config_id;
  IF p_config IS NOT NULL THEN UPDATE hotspot_configs SET status='awaiting_homologation',is_active=false,updated_at=now() WHERE id=p_config; END IF;
  INSERT INTO hotspot_assignment_history(device_id,assignment_version,previous_company_id,company_id,branch_id,actor_id)
    VALUES(d.id,d.assignment_version+1,d.company_id,c.company_id,c.branch_id,p_actor);
  UPDATE hotspot_devices SET company_id=c.company_id,branch_id=c.branch_id,hotspot_config_id=p_config,
    inventory_reseller_id=CASE WHEN p_action='allocate' THEN p_owner WHEN p_config IS NOT NULL THEN target_owner ELSE d.inventory_reseller_id END,
    status='transfer_pending',assignment_version=d.assignment_version+1,assignment_applied_version=NULL,
    assignment_requested_at=now(),assignment_applied_at=NULL,verification_expires_at=NULL,
    last_homologated_at=NULL,last_homologation_result=NULL,latitude=NULL,longitude=NULL,maps_url=NULL,
    active_sessions=0,rx_bytes=0,tx_bytes=0,sync_requested_at=NULL,sync_applied_at=NULL,
    reboot_requested_at=NULL,router_status_requested_at=NULL,router_status_applied_at=NULL,updated_at=now() WHERE id=d.id;
  RETURN d.id;
END $$;
REVOKE ALL ON FUNCTION public.manage_hotspot_inventory(uuid,text,uuid,integer,uuid,text,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.manage_hotspot_inventory(uuid,text,uuid,integer,uuid,text,text,uuid) TO service_role;

CREATE FUNCTION public.ack_hotspot_assignment(p_identity text,p_version integer) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE d public.hotspot_devices;
BEGIN
  SELECT * INTO d FROM hotspot_devices WHERE router_identity=p_identity FOR UPDATE;
  IF NOT FOUND OR d.assignment_version<>p_version THEN RETURN false; END IF;
  IF d.assignment_applied_version=p_version THEN RETURN true; END IF;
  IF d.status NOT IN ('stock','transfer_pending') THEN RETURN false; END IF;
  PERFORM set_config('manos.assignment_acknowledged','true',true);
  UPDATE hotspot_devices SET assignment_applied_version=p_version,credential_version=p_version,assignment_applied_at=now(),
    status=CASE WHEN company_id IS NULL THEN 'stock' ELSE 'verifying' END,
    verification_expires_at=NULL,updated_at=now() WHERE id=d.id;
  UPDATE hotspot_assignment_history SET applied_at=now() WHERE device_id=d.id AND assignment_version=p_version;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.ack_hotspot_assignment(text,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ack_hotspot_assignment(text,integer) TO service_role;

-- Row lock serializes final authorization with a transfer or cancellation.
CREATE FUNCTION public.validate_hotspot_assignment(p_identity text,p_username text) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE d public.hotspot_devices; g public.hotspot_access_grants;
BEGIN
  SELECT * INTO d FROM hotspot_devices WHERE router_identity=p_identity FOR UPDATE;
  IF NOT FOUND OR d.company_id IS NULL OR d.assignment_applied_version IS DISTINCT FROM d.assignment_version OR
    d.status NOT IN ('operational','verifying') THEN RETURN false; END IF;
  SELECT * INTO g FROM hotspot_access_grants WHERE username=p_username AND revoked_at IS NULL AND expires_at>now();
  IF NOT FOUND OR g.device_id IS DISTINCT FROM d.id OR g.assignment_version IS DISTINCT FROM d.assignment_version OR
    g.company_id IS DISTINCT FROM d.company_id OR g.portal_target_id IS DISTINCT FROM coalesce(d.branch_id,d.company_id) OR
    g.portal_target_kind<>(CASE WHEN d.branch_id IS NULL THEN 'company' ELSE 'branch' END) THEN RETURN false; END IF;
  IF d.status='verifying' THEN
    PERFORM set_config('manos.assignment_validated','true',true);
    UPDATE hotspot_devices SET status='operational',last_homologated_at=now(),verification_expires_at=NULL,
      last_homologation_result=jsonb_build_object('radius','accepted','assignment_version',d.assignment_version),updated_at=now() WHERE id=d.id;
    UPDATE hotspot_configs SET status='operational',is_active=true,updated_at=now() WHERE id=d.hotspot_config_id;
  END IF;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.validate_hotspot_assignment(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.validate_hotspot_assignment(text,text) TO service_role;

-- Close the gap between a portal lookup and inserting the credential.
CREATE FUNCTION public.guard_hotspot_grant_assignment() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE d public.hotspot_devices;
BEGIN
  SELECT * INTO d FROM hotspot_devices WHERE id=NEW.device_id FOR SHARE;
  IF NOT FOUND OR NEW.assignment_version IS DISTINCT FROM d.assignment_version OR
    d.assignment_applied_version IS DISTINCT FROM d.assignment_version OR
    NEW.company_id IS DISTINCT FROM d.company_id OR NEW.portal_target_id IS DISTINCT FROM coalesce(d.branch_id,d.company_id) OR
    NEW.portal_target_kind<>(CASE WHEN d.branch_id IS NULL THEN 'company' ELSE 'branch' END) OR
    d.status NOT IN ('operational','verifying') THEN
    RAISE EXCEPTION 'A RB não está liberada para este destino. Reconecte à rede.';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_hotspot_grant_assignment BEFORE INSERT ON public.hotspot_access_grants
FOR EACH ROW EXECUTE FUNCTION public.guard_hotspot_grant_assignment();
REVOKE ALL ON FUNCTION public.guard_hotspot_grant_assignment() FROM PUBLIC,anon,authenticated;

DROP POLICY IF EXISTS hotspot_audit_scoped_read ON public.hotspot_device_audit;
CREATE POLICY hotspot_audit_scoped_read ON public.hotspot_device_audit FOR SELECT TO authenticated USING (
  EXISTS(SELECT 1 FROM public.user_roles r WHERE r.user_id=(select auth.uid()) AND r.role='adm') OR
  EXISTS(SELECT 1 FROM public.hotspot_devices d JOIN public.user_roles r ON r.user_id=(select auth.uid())
    WHERE d.id=device_id AND (d.assignment_requested_at IS NULL OR hotspot_device_audit.created_at>=d.assignment_requested_at)
      AND ((r.role='matriz' AND r.company_id=d.company_id) OR
        (r.role='filial' AND r.branch_id=d.branch_id) OR (r.role='revenda' AND r.reseller_id=d.inventory_reseller_id)))
);
