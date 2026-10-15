import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE).href);
export const ids = {
  admin:'10000000-0000-4000-8000-000000000001', reseller:'10000000-0000-4000-8000-000000000002', other:'10000000-0000-4000-8000-000000000003',
  owner:'20000000-0000-4000-8000-000000000001', outsider:'20000000-0000-4000-8000-000000000002',
  restaurant:'30000000-0000-4000-8000-000000000001', workshop:'30000000-0000-4000-8000-000000000002', foreign:'30000000-0000-4000-8000-000000000003',
  config1:'40000000-0000-4000-8000-000000000001',config2:'40000000-0000-4000-8000-000000000002', config3:'40000000-0000-4000-8000-000000000003',
  device:'50000000-0000-4000-8000-000000000001',
};
export async function createTestDatabase() {
  const db = new PGlite();
  // Contract fixture for the pre-existing Supabase tables; migration under test is unmodified.
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;
    CREATE TABLE resellers(id uuid primary key);
    CREATE TABLE companies(id uuid primary key,name text,trade_name text,reseller_id uuid);
    CREATE TABLE branches(id uuid primary key,company_id uuid,reseller_id uuid,name text);
    CREATE TABLE user_roles(user_id uuid,role text,reseller_id uuid,company_id uuid,branch_id uuid);
    CREATE TABLE hotspot_configs(id uuid primary key,company_id uuid,branch_id uuid,vendor text,status text,is_active boolean,ap_mac text,updated_at timestamptz);
    CREATE TABLE hotspot_devices(id uuid primary key default gen_random_uuid(),router_identity text unique not null,
      company_id uuid not null references companies(id) on delete cascade,branch_id uuid references branches(id) on delete cascade,
      hotspot_config_id uuid not null unique references hotspot_configs(id) on delete cascade,
      status text not null constraint hotspot_devices_status_check check(status in ('operational','awaiting_homologation','blocked','suspended','error','awaiting_provisioning')),
      updated_at timestamptz,last_seen_at timestamptz,last_homologated_at timestamptz,last_homologation_result jsonb,
      latitude double precision,longitude double precision,maps_url text,active_sessions integer,rx_bytes bigint,tx_bytes bigint,ap_mac text,
      sync_requested_at timestamptz,sync_applied_at timestamptz,reboot_requested_at timestamptz,router_status_requested_at timestamptz,router_status_applied_at timestamptz);
    CREATE TABLE hotspot_access_grants(id uuid primary key default gen_random_uuid(),company_id uuid,portal_target_id uuid,portal_target_kind text,
      username text unique,revoked_at timestamptz,expires_at timestamptz,pending_checkin jsonb,visitor_id uuid,
      constraint hotspot_access_grants_pending_or_finalized_chk check(pending_checkin is not null or visitor_id is not null));
    CREATE TABLE hotspot_portal_handoffs(id uuid primary key default gen_random_uuid(),router_identity text);
    CREATE TABLE hotspot_device_audit(id uuid primary key default gen_random_uuid(),device_id uuid,created_at timestamptz default now());
    ALTER TABLE hotspot_devices ENABLE ROW LEVEL SECURITY;
    ALTER TABLE hotspot_device_audit ENABLE ROW LEVEL SECURITY;
    GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
    GRANT SELECT ON hotspot_devices,hotspot_device_audit,user_roles TO authenticated;
    INSERT INTO resellers VALUES('${ids.owner}'),('${ids.outsider}');
    INSERT INTO user_roles(user_id,role,reseller_id) VALUES('${ids.admin}','adm',null),('${ids.reseller}','revenda','${ids.owner}'),('${ids.other}','revenda','${ids.outsider}');
    INSERT INTO companies(id,name,reseller_id) VALUES('${ids.restaurant}','Restaurante demonstração','${ids.owner}'),('${ids.workshop}','Oficina demonstração','${ids.owner}'),('${ids.foreign}','Outra revenda','${ids.outsider}');
    INSERT INTO hotspot_configs VALUES('${ids.config1}','${ids.restaurant}',null,'mikrotik_hotspot','operational',true,null,now()),('${ids.config2}','${ids.workshop}',null,'mikrotik_hotspot','awaiting_homologation',false,null,now()),('${ids.config3}','${ids.foreign}',null,'mikrotik_hotspot','awaiting_homologation',false,null,now());
    INSERT INTO hotspot_devices(id,router_identity,company_id,hotspot_config_id,status,last_seen_at) VALUES('${ids.device}','MT-RB000001','${ids.restaurant}','${ids.config1}','operational',now());
    INSERT INTO hotspot_access_grants(company_id,portal_target_id,portal_target_kind,username,expires_at,pending_checkin) VALUES('${ids.restaurant}','${ids.restaurant}','company','legacy',now()+interval '10 minutes','{}');
  `);
  await db.exec(await readFile(new URL('../supabase/migrations/20261015003859_rb_inventory_and_assignment.sql',import.meta.url),'utf8'));
  return db;
}

export async function runTests() {
  const db=await createTestDatabase();
  let passed=0;
  const test=async(name,fn)=>{await fn();passed++;console.log('PASS '+name);};
  const state=async()=> (await db.query('select * from hotspot_devices where id=$1',[ids.device])).rows[0];
  const action=(actor,action,version,config=null,device=ids.device)=>db.query('select manage_hotspot_inventory($1,$2,$3,$4,$5)',[actor,action,device,version,config]);
  await test('migration preserves operational device and reseller ownership',async()=>{
    const d=await state(); assert.equal(d.status,'operational');assert.equal(d.assignment_version,0);assert.equal(d.inventory_reseller_id,ids.owner);
  });
  await test('foreign reseller cannot transfer device',()=>assert.rejects(action(ids.other,'transfer',0,ids.config2),/RB indisponível/));
  await test('reseller cannot transfer to a foreign destination',()=>assert.rejects(action(ids.reseller,'transfer',0,ids.config3),/fora da sua revenda/));
  await test('transfer revokes old grant and deactivates former config atomically',async()=>{
    await action(ids.reseller,'transfer',0,ids.config2);const d=await state();assert.equal(d.company_id,ids.workshop);assert.equal(d.status,'transfer_pending');assert.equal(d.assignment_applied_version,null);
    const old=(await db.query("select revoked_at,pending_checkin from hotspot_access_grants where username='legacy'")).rows[0];assert.ok(old.revoked_at);assert.equal(old.pending_checkin,null);
    assert.equal((await db.query('select is_active from hotspot_configs where id=$1',[ids.config1])).rows[0].is_active,false);
  });
  await test('stale screen cannot overwrite a transfer',()=>assert.rejects(action(ids.admin,'transfer',0,ids.config1),/Atualize/));
  await test('old assignment acknowledgement is rejected',async()=>assert.equal((await db.query("select ack_hotspot_assignment('MT-RB000001',0) as ok")).rows[0].ok,false));
  await test('manual status update cannot bypass pending cleanup',()=>assert.rejects(db.exec(`update hotspot_devices set status='operational' where id='${ids.device}'`),/Aguarde/));
  await test('acknowledgement automatically starts homologation',async()=>{
    await db.query("select ack_hotspot_assignment('MT-RB000001',1)");await db.query("select ack_hotspot_assignment('MT-RB000001',1)");assert.equal((await state()).status,'verifying');
  });
  await test('manual status change cannot bypass RADIUS check-in',()=>assert.rejects(db.exec(`update hotspot_devices set status='operational' where id='${ids.device}'`),/RADIUS/));
  await test('old company cannot issue a grant after transfer',()=>assert.rejects(db.exec(`insert into hotspot_access_grants(device_id,assignment_version,company_id,portal_target_id,portal_target_kind,username,expires_at,pending_checkin) values('${ids.device}',1,'${ids.restaurant}','${ids.restaurant}','company','wrong',now()+interval '10 minutes','{}')`),/não está liberada/));
  await test('current grant homologates only the current assignment',async()=>{
    await db.exec(`insert into hotspot_access_grants(device_id,assignment_version,company_id,portal_target_id,portal_target_kind,username,expires_at,pending_checkin) values('${ids.device}',1,'${ids.workshop}','${ids.workshop}','company','new',now()+interval '10 minutes','{}')`);
    assert.equal((await db.query("select validate_hotspot_assignment('MT-RB000001','legacy') as ok")).rows[0].ok,false);
    assert.equal((await db.query("select validate_hotspot_assignment('MT-RB000001','new') as ok")).rows[0].ok,true);assert.equal((await state()).status,'operational');
  });
  await test('return to inventory revokes current grant and waits for device',async()=>{
    await action(ids.admin,'transfer',1);assert.equal((await state()).company_id,null);assert.equal((await state()).status,'transfer_pending');
    assert.equal((await db.query("select validate_hotspot_assignment('MT-RB000001','new') as ok")).rows[0].ok,false);
    await db.exec("select ack_hotspot_assignment('MT-RB000001',2)");assert.equal((await state()).status,'stock');
  });
  await test('new physical devices have no tenant and need acknowledgement',async()=>{
    const r=await db.query("select manage_hotspot_inventory($1,'create',null,null,null,'RB 20','MT-RB000020') as id",[ids.reseller]);
    const d=(await db.query('select * from hotspot_devices where id=$1',[r.rows[0].id])).rows[0];assert.equal(d.status,'stock');assert.equal(d.company_id,null);assert.equal(d.assignment_applied_version,null);
  });
  await test('authenticated users cannot call service-only lifecycle RPCs',async()=>{
    await db.exec('SET ROLE authenticated');
    await assert.rejects(action(ids.admin,'transfer',2,ids.config1),/permission denied/);await db.exec('RESET ROLE');
  });
  await test('RLS hides stock from another reseller',async()=>{
    await db.exec(`SET ROLE authenticated; SET request.jwt.claim.sub='${ids.other}'`);
    assert.equal((await db.query('select * from hotspot_devices')).rows.length,0);
    await assert.rejects(db.query('select * from hotspot_assignment_history'),/permission denied/);
    await db.exec('RESET ROLE');
  });
  await test('stock owner sees their devices and admin sees all',async()=>{
    await db.exec(`SET ROLE authenticated; SET request.jwt.claim.sub='${ids.reseller}'`);assert.equal((await db.query('select * from hotspot_devices')).rows.length,2);await db.exec('RESET ROLE');
  });
  console.log(`${passed} database checks passed.`);await db.close();
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { await runTests(); } catch(e) { console.error(e.message, e.position ?? '',e.where ?? ''); process.exit(1); }
}
