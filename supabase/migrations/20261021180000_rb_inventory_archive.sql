-- Ação 'archive' no estoque de RBs: arquivar cadastro órfão/duplicado
-- (status 'suspended'; a lista do estoque já ignora arquivados).
-- Função recriada a partir de 20261015003859 com o novo ramo.

CREATE OR REPLACE FUNCTION public.manage_hotspot_inventory(p_actor uuid,p_action text,p_device uuid DEFAULT NULL,
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
  IF p_action='archive' THEN
    -- Arquiva um cadastro órfão/duplicado (ex.: a caixa física passou a
    -- operar sob outro cadastro e este nunca será confirmado). Só some
    -- do estoque: a RB física e o cadastro verdadeiro dela não mudam.
    IF d.status IN ('operational','verifying') THEN
      RAISE EXCEPTION 'RB em operação não pode ser arquivada. Devolva-a ao estoque primeiro.';
    END IF;
    UPDATE hotspot_access_grants SET revoked_at=now(),pending_checkin=NULL WHERE revoked_at IS NULL AND device_id=d.id;
    DELETE FROM hotspot_portal_handoffs WHERE device_id=d.id OR router_identity=d.router_identity;
    UPDATE hotspot_devices SET status='suspended',active_sessions=0,updated_at=now() WHERE id=d.id;
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
