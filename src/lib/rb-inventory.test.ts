import { afterEach, describe, expect, it } from "vitest";
import { assignmentAllowsAccess, deriveDestinationIdentity, grantMatchesAssignment, inventorySection, normalizeMac, stockCardTitle, type InventoryDevice } from "./rb-inventory";
import { assignmentCleanupScript, assignmentSignature, validAssignmentSignature } from "./rb-assignment.server";
import { hasAssignedRouterAuth, hotspotRouterToken } from "./hotspot-router-auth";

const originalSecret=process.env["HOTSPOT_CREDENTIAL_SECRET"];
afterEach(()=> { if(originalSecret===undefined)delete process.env["HOTSPOT_CREDENTIAL_SECRET"];else process.env["HOTSPOT_CREDENTIAL_SECRET"]=originalSecret; });
const d:InventoryDevice={ id:"rb", router_identity:"MT-RB000001",inventory_label:null,inventory_reseller_id:null,
  company_id:"company",branch_id:null,hotspot_config_id:"config",status:"operational",assignment_version:2,
  assignment_applied_version:2,last_seen_at:null,assignment_requested_at:null,assignment_applied_at:null,verification_expires_at:null,ap_mac:null };
const g={ device_id:"rb",assignment_version:2,company_id:"company",portal_target_id:"company",portal_target_kind:"company" };
describe("RB assignment isolation",()=>{
  it("rejects pending, stock, blocked and suspended assignments",()=>{
    for(const status of ["transfer_pending","stock","blocked","suspended","awaiting_homologation"]) expect(assignmentAllowsAccess({...d,status})).toBe(false);
    expect(assignmentAllowsAccess({...d,assignment_applied_version:1})).toBe(false);
  });
  it("binds grants to physical device, tenant, branch and generation",()=>{
    expect(grantMatchesAssignment(d,g)).toBe(true);
    for(const change of [{device_id:"other"},{assignment_version:1},{company_id:"other"},{portal_target_id:"other"},{portal_target_kind:"event"}]) expect(grantMatchesAssignment(d,{...g,...change})).toBe(false);
    expect(grantMatchesAssignment({...d,branch_id:"branch"},g)).toBe(false);
    expect(grantMatchesAssignment({...d,branch_id:"branch"},{...g,portal_target_kind:"branch",portal_target_id:"branch"})).toBe(true);
  });
  it("allows the first check-in to verify the automatically applied assignment",()=>{
    expect(assignmentAllowsAccess({...d,status:"verifying"})).toBe(true);
    expect(assignmentAllowsAccess({...d,status:"verifying",assignment_applied_version:null})).toBe(false);
  });
  it("rotates device credentials and rejects the previous credential after ack",()=>{
    process.env["HOTSPOT_CREDENTIAL_SECRET"]="x".repeat(40);
    const req=(v:number)=>new Request("https://example.test",{headers:{"x-manos-heartbeat":hotspotRouterToken(d.router_identity,v)!}});
    const pending={...d,credential_version:1,assignment_applied_version:null};
    expect(hasAssignedRouterAuth(req(1),d.router_identity,pending)).toBe(true);
    expect(hasAssignedRouterAuth(req(2),d.router_identity,pending)).toBe(true);
    expect(hasAssignedRouterAuth(req(1),d.router_identity,{...d,credential_version:2})).toBe(false);
    expect(hasAssignedRouterAuth(req(0),d.router_identity,{...d,credential_version:2})).toBe(false);
  });
  it("binds ack to identity and generation and places it after cleanup and credential installation",()=>{
    process.env["HOTSPOT_CREDENTIAL_SECRET"]="x".repeat(40);
    const sig=assignmentSignature(d.router_identity,2);
    expect(validAssignmentSignature(d.router_identity,2,sig)).toBe(true);
    expect(validAssignmentSignature(d.router_identity,3,sig)).toBe(false);
    expect(validAssignmentSignature("MT-RB000011",2,sig)).toBe(false);
    const script=assignmentCleanupScript(d.router_identity,2);
    expect(script.indexOf('/ip hotspot active remove')).toBeLessThan(script.lastIndexOf('/tool fetch url="https://manostech-system.com.br/api/internal/hotspot-assignment-ack'));
    expect(script).toContain(hotspotRouterToken(d.router_identity,2));
    expect(script).not.toMatch(/reset-configuration|\/interface.*remove|\/ip address.*remove/);
    expect(()=>assignmentCleanupScript('MT-X"; /system reset-configuration',2)).toThrow();
  });
});

describe("Estoque de RBs por MAC",()=>{
  it("normaliza o MAC para maiúsculo com dois-pontos ou rejeita",()=>{
    expect(normalizeMac("cc:2d:e0:3b:d1:ef")).toBe("CC:2D:E0:3B:D1:EF");
    expect(normalizeMac("CC-2D-E0-3B-D1-EF")).toBe("CC:2D:E0:3B:D1:EF");
    expect(normalizeMac("cc2de03bd1ef")).toBe("CC:2D:E0:3B:D1:EF");
    expect(normalizeMac("CC:2D:E0")).toBe(null);
    expect(normalizeMac("")).toBe(null);
    expect(normalizeMac(null)).toBe(null);
  });
  it("separa estoque (zerada ou aguardando) de operacional",()=>{
    for(const status of ["stock","transfer_pending","verifying","awaiting_homologation","awaiting_provisioning"])
      expect(inventorySection({status})).toBe("stock");
    for(const status of ["operational","blocked","error"])
      expect(inventorySection({status})).toBe("operational");
  });
  it("mostra o MAC no cartão em estoque sem destino, e o nome quando há destino",()=>{
    const stock = {...d, company_id:null, hotspot_config_id:null, inventory_label:null, ap_mac:"CC:2D:E0:3B:D1:EF", status:"stock"};
    expect(stockCardTitle(stock)).toBe("CC:2D:E0:3B:D1:EF");
    expect(stockCardTitle({...stock, ap_mac:null})).toBe("RB sem MAC");
    expect(stockCardTitle({...d, inventory_label:"Padaria Barão"})).toBe("Padaria Barão");
    expect(stockCardTitle({...d, inventory_label:null})).toBe("MT-RB000001");
  });
});

describe("Identidade acompanha o destino",()=>{
  it("deriva MT- do nome do destino, sem acento e com hífens",()=>{
    expect(deriveDestinationIdentity("Boteco do Barão · Matriz")).toBe("MT-BOTECO-DO-BARAO");
    expect(deriveDestinationIdentity("Açaí do Guri · Matriz")).toBe("MT-ACAI-DO-GURI");
    expect(deriveDestinationIdentity("Efraim Padaria e Confeitaria LTDA · Filial Centro")).toBe("MT-EFRAIM-PADARIA-E-CONFEITARIA-LTDA");
    expect(deriveDestinationIdentity("Empresa · Matriz")).toBe("MT-EMPRESA");
  });
  it("devolve vazio quando não dá para derivar um nome válido",()=>{
    expect(deriveDestinationIdentity("Pão · Matriz")).toBe("");
    expect(deriveDestinationIdentity(" · Matriz")).toBe("");
    expect(deriveDestinationIdentity("")).toBe("");
  });
  it("limita a identidade a 48 caracteres após o prefixo",()=>{
    const derived = deriveDestinationIdentity("Uma Empresa Com Um Nome Extremamente Longo Para Testar O Limite · Matriz");
    expect(derived).toMatch(/^MT-[A-Z0-9-]{6,48}$/);
    expect(derived.length).toBeLessThanOrEqual(51);
  });
});
