-- Identidade acompanha o destino: ao devolver ao estoque a RB zera
-- (rótulo NULL, cartão mostra só o MAC — já existia); ao atribuir a um
-- destino, a RB ganha a identidade do destino novo, e o nome antigo nunca
-- ressurge. O flip só acontece no ack, depois que a caixa adota o nome
-- novo (script de assignment) — trocar só no painel a órfã.
ALTER TABLE public.hotspot_devices ADD COLUMN IF NOT EXISTS pending_router_identity text;

-- Guard: o flip de identidade é permitido SOMENTE no ack de um rename
-- pendente (pending = nova identidade, applied = version, vindo de
-- transfer_pending). Qualquer outra troca continua proibida.
CREATE OR REPLACE FUNCTION public.guard_hotspot_assignment() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF NEW.router_identity IS DISTINCT FROM OLD.router_identity AND NOT (
    OLD.pending_router_identity IS NOT NULL
    AND OLD.pending_router_identity = NEW.router_identity
    AND NEW.assignment_applied_version IS NOT NULL
    AND NEW.assignment_applied_version = NEW.assignment_version
    AND OLD.status = 'transfer_pending'
  ) THEN
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

-- Ack: aceita a identidade atual OU a pendente; ao confirmar, vira a
-- identidade para a nova e limpa o pending. Um ack com a identidade antiga
-- enquanto há rename pendente NÃO confirma (a caixa busca o script de novo).
CREATE OR REPLACE FUNCTION public.ack_hotspot_assignment(p_identity text,p_version integer) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE d public.hotspot_devices;
BEGIN
  SELECT * INTO d FROM hotspot_devices
    WHERE router_identity=p_identity OR pending_router_identity=p_identity
    ORDER BY (pending_router_identity = p_identity) DESC FOR UPDATE;
  IF NOT FOUND OR d.assignment_version<>p_version THEN RETURN false; END IF;
  IF d.assignment_applied_version=p_version THEN RETURN true; END IF;
  IF d.status NOT IN ('stock','transfer_pending') THEN RETURN false; END IF;
  IF d.pending_router_identity IS NOT NULL AND d.pending_router_identity <> p_identity THEN RETURN false; END IF;
  PERFORM set_config('manos.assignment_acknowledged','true',true);
  UPDATE hotspot_devices SET assignment_applied_version=p_version,credential_version=p_version,assignment_applied_at=now(),
    router_identity=p_identity, pending_router_identity=NULL,
    status=CASE WHEN company_id IS NULL THEN 'stock' ELSE 'verifying' END,
    verification_expires_at=NULL,updated_at=now() WHERE id=d.id;
  UPDATE hotspot_assignment_history SET applied_at=now() WHERE device_id=d.id AND assignment_version=p_version;
  RETURN true;
END $$;

-- manage recriado a partir de 20261027180000: ganha p_new_identity (10º
-- parâmetro, DEFAULT NULL); a função antiga de 9 parâmetros é removida
-- antes para não virar overload.
DROP FUNCTION IF EXISTS public.manage_hotspot_inventory(uuid,text,uuid,integer,uuid,text,text,uuid,text);

CREATE FUNCTION public.manage_hotspot_inventory(p_actor uuid,p_action text,p_device uuid DEFAULT NULL,
  p_version integer DEFAULT NULL,p_config uuid DEFAULT NULL,p_label text DEFAULT NULL,p_identity text DEFAULT NULL,p_owner uuid DEFAULT NULL,
  p_mac text DEFAULT NULL,
  p_new_identity text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE d public.hotspot_devices; c public.hotspot_configs; admin_user boolean; owner_id uuid; target_owner uuid;
DECLARE v_hex text; v_mac text; v_count integer; target_label text; v_new_identity text;
BEGIN
  SELECT EXISTS(SELECT 1 FROM user_roles WHERE user_id=p_actor AND role='adm') INTO admin_user;
  SELECT reseller_id INTO owner_id FROM user_roles WHERE user_id=p_actor AND role='revenda' AND reseller_id IS NOT NULL LIMIT 1;
  IF NOT admin_user AND owner_id IS NULL THEN RAISE EXCEPTION 'Sem permissão para gerenciar estoque.'; END IF;

  -- MAC normalizado uma única vez (XX:XX:XX:XX:XX:XX, maiúsculo). Comparações
  -- usam o formato sem separadores para casar com MACs antigos gravados em
  -- qualquer formato. String vazia = sem MAC, não erro.
  IF p_mac IS NOT NULL AND length(trim(p_mac)) > 0 THEN
    v_hex := upper(regexp_replace(p_mac, '[^0-9A-Fa-f]', '', 'g'));
    IF length(v_hex) <> 12 THEN RAISE EXCEPTION 'MAC inválido.'; END IF;
    v_mac := substr(v_hex,1,2)||':'||substr(v_hex,3,2)||':'||substr(v_hex,5,2)||':'||substr(v_hex,7,2)||':'||substr(v_hex,9,2)||':'||substr(v_hex,11,2);
  END IF;

  IF p_action='create' THEN
    IF p_identity !~ '^MT-[A-Z0-9-]{6,48}$' OR p_identity IS NULL THEN
      RAISE EXCEPTION 'Identificação inválida.';
    END IF;
    -- Nome opcional quando há MAC: sem nome, o cartão mostra o MAC.
    IF (p_label IS NULL OR length(trim(p_label)) NOT BETWEEN 1 AND 80) AND v_mac IS NULL THEN
      RAISE EXCEPTION 'Informe o nome ou o MAC da RB.';
    END IF;
    IF v_mac IS NOT NULL AND EXISTS(SELECT 1 FROM hotspot_devices
        WHERE upper(regexp_replace(coalesce(ap_mac,''), '[^0-9A-Fa-f]', '', 'g')) = v_hex AND status <> 'suspended') THEN
      RAISE EXCEPTION 'Já existe uma RB com este MAC.';
    END IF;
    INSERT INTO hotspot_devices(router_identity,inventory_label,inventory_reseller_id,status,assignment_version,assignment_applied_version,assignment_requested_at,ap_mac)
    VALUES(p_identity,NULLIF(trim(p_label),''),CASE WHEN admin_user THEN NULL ELSE owner_id END,'stock',1,NULL,now(),v_mac) RETURNING id INTO p_device;
    RETURN p_device;
  END IF;

  -- Atribuir por MAC: acha a RB em estoque pelo MAC e cai no fluxo normal de
  -- transferência abaixo (mesmas travas de versão, revenda e destino ocupado).
  IF p_action='assign_by_mac' THEN
    IF v_mac IS NULL THEN RAISE EXCEPTION 'Informe o MAC da RB.'; END IF;
    SELECT count(*) INTO v_count FROM hotspot_devices
      WHERE upper(regexp_replace(coalesce(ap_mac,''), '[^0-9A-Fa-f]', '', 'g')) = v_hex AND status='stock';
    IF v_count = 0 THEN RAISE EXCEPTION 'MAC não está no estoque — cadastre a RB no estoque primeiro.'; END IF;
    IF v_count > 1 THEN RAISE EXCEPTION 'MAC duplicado no estoque — arquive a duplicata.'; END IF;
    SELECT id, assignment_version INTO p_device, p_version FROM hotspot_devices
      WHERE upper(regexp_replace(coalesce(ap_mac,''), '[^0-9A-Fa-f]', '', 'g')) = v_hex AND status='stock';
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
  IF p_action='set_mac' THEN
    IF v_mac IS NULL THEN RAISE EXCEPTION 'Informe o MAC da RB.'; END IF;
    IF d.status <> 'stock' THEN RAISE EXCEPTION 'Só RBs em estoque recebem MAC por aqui.'; END IF;
    IF EXISTS(SELECT 1 FROM hotspot_devices
        WHERE upper(regexp_replace(coalesce(ap_mac,''), '[^0-9A-Fa-f]', '', 'g')) = v_hex AND id<>d.id AND status <> 'suspended') THEN
      RAISE EXCEPTION 'Já existe outra RB com este MAC.';
    END IF;
    UPDATE hotspot_devices SET ap_mac=v_mac,updated_at=now() WHERE id=d.id;
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
  -- Rename pendente: a identidade nova só vira efetiva quando a caixa a
  -- adota (script de assignment) e confirma no ack. Se já houver uma
  -- atribuição pendente, o rename acopla a ela (mesma versão).
  IF p_action='rename' THEN
    IF d.status='suspended' THEN RAISE EXCEPTION 'Operação indisponível.'; END IF;
    IF p_new_identity IS NULL OR p_new_identity !~ '^MT-[A-Z0-9-]{6,48}$' THEN
      RAISE EXCEPTION 'Identificação inválida.';
    END IF;
    IF p_new_identity = d.router_identity OR p_new_identity = d.pending_router_identity THEN RETURN d.id; END IF;
    IF EXISTS(SELECT 1 FROM hotspot_devices WHERE id<>d.id
        AND (router_identity=p_new_identity OR pending_router_identity=p_new_identity)) THEN
      RAISE EXCEPTION 'Já existe uma RB com esta identificação.';
    END IF;
    IF d.status='transfer_pending' AND d.assignment_applied_version IS NULL THEN
      UPDATE hotspot_devices SET pending_router_identity=p_new_identity,
        assignment_requested_at=now(),updated_at=now() WHERE id=d.id;
    ELSE
      UPDATE hotspot_devices SET pending_router_identity=p_new_identity,
        status='transfer_pending',assignment_version=d.assignment_version+1,assignment_applied_version=NULL,
        assignment_requested_at=now(),assignment_applied_at=NULL,verification_expires_at=NULL,updated_at=now() WHERE id=d.id;
    END IF;
    RETURN d.id;
  END IF;
  IF p_action NOT IN ('transfer','allocate','assign_by_mac') OR d.status='suspended' THEN RAISE EXCEPTION 'Operação indisponível.'; END IF;
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
  -- Rename junto com a atribuição: valida formato e unicidade global
  -- (identidade e pending, inclusive arquivados: a identidade nunca pode
  -- ser ambígua nos lookups por router_identity OU pending_router_identity).
  -- Sem destino (devolver/allocate) não há rename: pending fica NULL.
  v_new_identity := NULL;
  IF p_config IS NOT NULL AND p_new_identity IS NOT NULL THEN
    IF p_new_identity !~ '^MT-[A-Z0-9-]{6,48}$' THEN RAISE EXCEPTION 'Identificação inválida.'; END IF;
    IF p_new_identity <> d.router_identity THEN
      IF EXISTS(SELECT 1 FROM hotspot_devices WHERE id<>d.id
          AND (router_identity=p_new_identity OR pending_router_identity=p_new_identity)) THEN
        RAISE EXCEPTION 'Já existe uma RB com esta identificação.';
      END IF;
      v_new_identity := p_new_identity;
    END IF;
  END IF;
  -- Cancel old grants, including credentials issued by older application versions.
  UPDATE hotspot_access_grants SET revoked_at=now(),pending_checkin=NULL WHERE revoked_at IS NULL AND
    (device_id=d.id OR (device_id IS NULL AND company_id=d.company_id AND portal_target_id=coalesce(d.branch_id,d.company_id)));
  DELETE FROM hotspot_portal_handoffs WHERE device_id=d.id OR router_identity=d.router_identity;
  UPDATE hotspot_configs SET status='awaiting_homologation',is_active=false,ap_mac=NULL,updated_at=now() WHERE id=d.hotspot_config_id;
  IF p_config IS NOT NULL THEN UPDATE hotspot_configs SET status='awaiting_homologation',is_active=false,updated_at=now() WHERE id=p_config; END IF;
  -- Na atribuição por MAC, a config nova também registra o MAC da caixa.
  IF p_action='assign_by_mac' AND v_mac IS NOT NULL THEN UPDATE hotspot_configs SET ap_mac=v_mac,updated_at=now() WHERE id=p_config; END IF;
  INSERT INTO hotspot_assignment_history(device_id,assignment_version,previous_company_id,company_id,branch_id,actor_id)
    VALUES(d.id,d.assignment_version+1,d.company_id,c.company_id,c.branch_id,p_actor);
  -- O nome vem do destino; devolver (sem config) zera o nome junto com o vínculo.
  IF p_config IS NOT NULL THEN
    SELECT coalesce(co.trade_name, co.name, 'Empresa') || CASE WHEN c.branch_id IS NULL THEN ' · Matriz' ELSE ' · ' || coalesce(b.name, 'Filial') END
      INTO target_label FROM companies co LEFT JOIN branches b ON b.id = c.branch_id WHERE co.id = c.company_id;
  END IF;
  UPDATE hotspot_devices SET company_id=c.company_id,branch_id=c.branch_id,hotspot_config_id=p_config,
    inventory_label=CASE WHEN p_config IS NULL THEN NULL ELSE target_label END,
    inventory_reseller_id=CASE WHEN p_action='allocate' THEN p_owner WHEN p_config IS NOT NULL THEN target_owner ELSE d.inventory_reseller_id END,
    status='transfer_pending',assignment_version=d.assignment_version+1,assignment_applied_version=NULL,
    pending_router_identity=v_new_identity,
    assignment_requested_at=now(),assignment_applied_at=NULL,verification_expires_at=NULL,
    last_homologated_at=NULL,last_homologation_result=NULL,latitude=NULL,longitude=NULL,maps_url=NULL,
    active_sessions=0,rx_bytes=0,tx_bytes=0,sync_requested_at=NULL,sync_applied_at=NULL,
    reboot_requested_at=NULL,router_status_requested_at=NULL,router_status_applied_at=NULL,updated_at=now() WHERE id=d.id;
  RETURN d.id;
END $$;
REVOKE ALL ON FUNCTION public.manage_hotspot_inventory(uuid,text,uuid,integer,uuid,text,text,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.manage_hotspot_inventory(uuid,text,uuid,integer,uuid,text,text,uuid,text,text) TO service_role;
