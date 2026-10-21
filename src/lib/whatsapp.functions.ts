import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  evolutionConfig,
  evolutionCriarInstancia,
  evolutionQrCode,
  evolutionEstado,
  evolutionNumero,
  evolutionDesconectar,
  limiteDiario,
  estimativaDias,
  somenteDigitos,
} from "@/lib/whatsapp.server";

type WhatsappScope = {
  role: "matriz" | "filial";
  companyId: string;
  branchId: string | null;
  userId: string;
};

async function resolveWhatsappScope(supabase: any, userId: string): Promise<WhatsappScope> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role, company_id, branch_id")
    .eq("user_id", userId);
  if (error || !data?.length) {
    throw new Error("Sem permissão para acessar os disparos de WhatsApp.");
  }
  const linhas = data as Array<{
    role: string;
    company_id: string | null;
    branch_id: string | null;
  }>;
  const matriz = linhas.find((l) => l.role === "matriz" && l.company_id);
  const filial = linhas.find((l) => l.role === "filial" && l.company_id);
  const escolhida = matriz || filial;
  if (!escolhida?.company_id) {
    throw new Error("Os disparos de WhatsApp estão disponíveis para Matriz e Filial.");
  }
  return {
    role: matriz ? "matriz" : "filial",
    companyId: escolhida.company_id,
    branchId: matriz ? null : escolhida.branch_id,
    userId,
  };
}

function isMissingWhatsappTable(error: unknown) {
  const msg = error && typeof error === "object" ? JSON.stringify(error).toLowerCase() : "";
  return (
    msg.includes("whatsapp_") &&
    (msg.includes("schema cache") || msg.includes("does not exist") || msg.includes("pgrst205"))
  );
}

function inicioHojeSP(): string {
  const agora = new Date();
  const sp = new Date(agora.getTime() - 3 * 60 * 60 * 1000);
  const y = sp.getUTCFullYear();
  const m = String(sp.getUTCMonth() + 1).padStart(2, "0");
  const d = String(sp.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}T03:00:00.000Z`;
}

function hojeSP(): string {
  return inicioHojeSP().slice(0, 10);
}

async function buscarInstancia(admin: any, scope: WhatsappScope) {
  let q = admin
    .from("whatsapp_instancias")
    .select("*")
    .eq("company_id", scope.companyId);
  q = scope.branchId ? q.eq("branch_id", scope.branchId) : q.is("branch_id", null);
  const { data, error } = await q.maybeSingle();
  if (error) {
    if (isMissingWhatsappTable(error)) return { migrationRequired: true as const };
    throw new Error("Erro ao carregar a conexão do WhatsApp.");
  }
  return { instancia: data as any | null };
}

async function contar(admin: any, tabela: string, montar: (q: any) => any): Promise<number> {
  const { count } = await montar(
    admin.from(tabela).select("id", { count: "exact", head: true }),
  );
  return count ?? 0;
}

export const getWhatsappPainel = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const scope = await resolveWhatsappScope(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin: any = supabaseAdmin;
    const evo = evolutionConfig();

    const inst = await buscarInstancia(admin, scope);
    if ("migrationRequired" in inst) {
      return {
        migrationRequired: true,
        evolutionConfigurado: evo.configurado,
        role: scope.role,
        instancia: null,
        base: { total: 0, autorizados: 0 },
        limiteHoje: 0,
        enviadosHoje: 0,
        campanhas: [] as any[],
      };
    }
    const instancia = inst.instancia;

    const [totalBase, autorizados] = await Promise.all([
      contar(admin, "visitors", (q) => q.eq("company_id", scope.companyId)),
      contar(admin, "visitors", (q) =>
        q
          .eq("company_id", scope.companyId)
          .eq("whatsapp_opt_in", true)
          .is("marketing_consent_revoked_at", null),
      ),
    ]);

    let enviadosHoje = 0;
    if (instancia) {
      enviadosHoje = await contar(admin, "whatsapp_fila", (q) =>
        q
          .eq("instancia_id", instancia.id)
          .eq("status", "enviado")
          .gte("enviado_em", inicioHojeSP()),
      );
    }

    const { data: campanhasRaw } = await admin
      .from("whatsapp_campanhas")
      .select("id, titulo, mensagem, status, total, created_at, concluida_em")
      .eq("company_id", scope.companyId)
      .order("created_at", { ascending: false })
      .limit(20);

    const campanhas = await Promise.all(
      (campanhasRaw || []).map(async (c: any) => {
        const [enviados, pendentes, falhas, optouts] = await Promise.all([
          contar(admin, "whatsapp_fila", (q) => q.eq("campanha_id", c.id).eq("status", "enviado")),
          contar(admin, "whatsapp_fila", (q) => q.eq("campanha_id", c.id).eq("status", "pendente")),
          contar(admin, "whatsapp_fila", (q) =>
            q.eq("campanha_id", c.id).in("status", ["erro", "sem_whatsapp"]),
          ),
          contar(admin, "whatsapp_fila", (q) => q.eq("campanha_id", c.id).eq("status", "optout")),
        ]);
        return { ...c, enviados, pendentes, falhas, optouts };
      }),
    );

    return {
      migrationRequired: false,
      evolutionConfigurado: evo.configurado,
      role: scope.role,
      instancia: instancia
        ? {
            id: instancia.id,
            numero: instancia.numero,
            status: instancia.status,
            aquecimentoInicio: instancia["aquecimento_inicio"],
            conectadaEm: instancia.conectada_em,
          }
        : null,
      base: { total: totalBase, autorizados },
      limiteHoje: instancia ? limiteDiario(instancia["aquecimento_inicio"]) : 30,
      enviadosHoje,
      campanhas,
    };
  });

async function garantirInstancia(admin: any, scope: WhatsappScope) {
  const atual = await buscarInstancia(admin, scope);
  if ("migrationRequired" in atual) {
    throw new Error("A estrutura de disparos ainda não foi aplicada no banco.");
  }
  if (atual.instancia) return atual.instancia;
  const instanceName = `manos-${scope.companyId.slice(0, 8)}-${
    scope.branchId ? scope.branchId.slice(0, 8) : "matriz"
  }`;
  const { data, error } = await admin
    .from("whatsapp_instancias")
    .insert({
      company_id: scope.companyId,
      branch_id: scope.branchId,
      instance_name: instanceName,
    })
    .select("*")
    .single();
  if (error) throw new Error("Erro ao preparar a conexão do WhatsApp.");
  return data as any;
}

async function marcarConectada(admin: any, instancia: any) {
  const numero = await evolutionNumero(instancia.instance_name);
  const patch: Record<string, unknown> = {
    status: "conectada",
    conectada_em: new Date().toISOString(),
    numero,
    updated_at: new Date().toISOString(),
  };
  if (!instancia["aquecimento_inicio"]) patch["aquecimento_inicio"] = hojeSP();
  await admin.from("whatsapp_instancias").update(patch).eq("id", instancia.id);
  return { ...instancia, ...patch };
}

export const conectarWhatsapp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const scope = await resolveWhatsappScope(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin: any = supabaseAdmin;
    if (!evolutionConfig().configurado) return { configurado: false as const };
    const instancia = await garantirInstancia(admin, scope);
    await evolutionCriarInstancia(instancia.instance_name);
    const estado = await evolutionEstado(instancia.instance_name).catch(() => "close");
    if (estado === "open") {
      const atualizada = await marcarConectada(admin, instancia);
      return {
        configurado: true as const,
        status: "conectada" as const,
        numero: atualizada.numero,
        qr: null as string | null,
      };
    }
    await admin
      .from("whatsapp_instancias")
      .update({ status: "conectando", updated_at: new Date().toISOString() })
      .eq("id", instancia.id);
    const qr = await evolutionQrCode(instancia.instance_name);
    return { configurado: true as const, status: "conectando" as const, numero: null, qr };
  });

export const statusWhatsapp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const scope = await resolveWhatsappScope(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin: any = supabaseAdmin;
    if (!evolutionConfig().configurado) return { configurado: false as const };
    const inst = await buscarInstancia(admin, scope);
    if ("migrationRequired" in inst || !inst.instancia) {
      return { configurado: true as const, status: "desconectada" as const, numero: null };
    }
    const estado = await evolutionEstado(inst.instancia.instance_name).catch(() => "close");
    if (estado === "open") {
      const atualizada = await marcarConectada(admin, inst.instancia);
      return {
        configurado: true as const,
        status: "conectada" as const,
        numero: atualizada.numero,
      };
    }
    if (inst.instancia.status === "conectada") {
      await admin
        .from("whatsapp_instancias")
        .update({ status: "desconectada", updated_at: new Date().toISOString() })
        .eq("id", inst.instancia.id);
    }
    return {
      configurado: true as const,
      status: (inst.instancia.status === "conectando" ? "conectando" : "desconectada") as
        | "conectando"
        | "desconectada",
      numero: null,
    };
  });

export const desconectarWhatsapp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const scope = await resolveWhatsappScope(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin: any = supabaseAdmin;
    const inst = await buscarInstancia(admin, scope);
    if ("migrationRequired" in inst || !inst.instancia) return { ok: true };
    if (evolutionConfig().configurado) {
      await evolutionDesconectar(inst.instancia.instance_name).catch(() => undefined);
    }
    await admin
      .from("whatsapp_instancias")
      .update({ status: "desconectada", numero: null, updated_at: new Date().toISOString() })
      .eq("id", inst.instancia.id);
    return { ok: true };
  });

const criarCampanhaSchema = z.object({
  titulo: z.string().trim().min(3).max(80),
  mensagem: z.string().trim().min(10).max(1000),
});

export const criarCampanhaWhatsapp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(criarCampanhaSchema)
  .handler(async ({ data, context }) => {
    const scope = await resolveWhatsappScope(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin: any = supabaseAdmin;
    const inst = await buscarInstancia(admin, scope);
    if ("migrationRequired" in inst) {
      throw new Error("A estrutura de disparos ainda não foi aplicada no banco.");
    }
    const instancia = inst.instancia;
    if (!instancia || instancia.status !== "conectada") {
      throw new Error("Conecte o WhatsApp da unidade antes de disparar.");
    }

    // Base: SOMENTE quem autorizou no check-in e não revogou depois.
    type Visitante = { id: string; full_name: string; phone_e164: string };
    const visitantes: Visitante[] = [];
    const pagina = 1000;
    for (let desde = 0; ; desde += pagina) {
      const { data: lote, error } = await admin
        .from("visitors")
        .select("id, full_name, phone_e164")
        .eq("company_id", scope.companyId)
        .eq("whatsapp_opt_in", true)
        .is("marketing_consent_revoked_at", null)
        .order("created_at", { ascending: true })
        .range(desde, desde + pagina - 1);
      if (error) throw new Error("Erro ao montar a lista de contatos autorizados.");
      visitantes.push(...((lote || []) as Visitante[]));
      if (!lote || lote.length < pagina) break;
    }

    const vistos = new Set<string>();
    const destinatarios = visitantes
      .map((v) => ({
        visitor_id: v.id,
        telefone: somenteDigitos(v.phone_e164),
        nome: v.full_name,
      }))
      .filter((d) => {
        if (d.telefone.length < 12 || vistos.has(d.telefone)) return false;
        vistos.add(d.telefone);
        return true;
      });

    if (destinatarios.length === 0) {
      throw new Error("Nenhum contato autorizado na base ainda. Os contatos entram quando o cliente autoriza no check-in do Wi-Fi.");
    }

    const { data: campanha, error: erroCampanha } = await admin
      .from("whatsapp_campanhas")
      .insert({
        company_id: scope.companyId,
        branch_id: scope.branchId,
        instancia_id: instancia.id,
        titulo: data.titulo,
        mensagem: data.mensagem,
        total: destinatarios.length,
        created_by: scope.userId,
      })
      .select("id")
      .single();
    if (erroCampanha || !campanha) throw new Error("Erro ao criar o disparo.");

    const linhas = destinatarios.map((d) => ({
      campanha_id: campanha.id,
      instancia_id: instancia.id,
      company_id: scope.companyId,
      visitor_id: d.visitor_id,
      telefone: d.telefone,
      nome: d.nome,
    }));
    for (let i = 0; i < linhas.length; i += 500) {
      const { error: erroFila } = await admin
        .from("whatsapp_fila")
        .insert(linhas.slice(i, i + 500));
      if (erroFila) {
        await admin.from("whatsapp_campanhas").delete().eq("id", campanha.id);
        throw new Error("Erro ao montar a fila de envio. Tente novamente.");
      }
    }

    return {
      campanhaId: campanha.id as string,
      total: destinatarios.length,
      diasEstimados: estimativaDias(destinatarios.length, instancia["aquecimento_inicio"]),
    };
  });

const campanhaIdSchema = z.object({ id: z.string().uuid() });

async function campanhaDoEscopo(admin: any, scope: WhatsappScope, id: string) {
  const { data } = await admin
    .from("whatsapp_campanhas")
    .select("id, status")
    .eq("id", id)
    .eq("company_id", scope.companyId)
    .maybeSingle();
  if (!data) throw new Error("Disparo não encontrado.");
  return data as { id: string; status: string };
}

export const pausarCampanhaWhatsapp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(campanhaIdSchema)
  .handler(async ({ data, context }) => {
    const scope = await resolveWhatsappScope(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin: any = supabaseAdmin;
    const campanha = await campanhaDoEscopo(admin, scope, data.id);
    if (campanha.status !== "enviando") throw new Error("Este disparo não está em andamento.");
    await admin.from("whatsapp_campanhas").update({ status: "pausada" }).eq("id", data.id);
    return { ok: true };
  });

export const retomarCampanhaWhatsapp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(campanhaIdSchema)
  .handler(async ({ data, context }) => {
    const scope = await resolveWhatsappScope(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin: any = supabaseAdmin;
    const campanha = await campanhaDoEscopo(admin, scope, data.id);
    if (campanha.status !== "pausada") throw new Error("Este disparo não está pausado.");
    await admin.from("whatsapp_campanhas").update({ status: "enviando" }).eq("id", data.id);
    return { ok: true };
  });

export const cancelarCampanhaWhatsapp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(campanhaIdSchema)
  .handler(async ({ data, context }) => {
    const scope = await resolveWhatsappScope(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin: any = supabaseAdmin;
    const campanha = await campanhaDoEscopo(admin, scope, data.id);
    if (campanha.status === "concluida" || campanha.status === "cancelada") {
      throw new Error("Este disparo já foi encerrado.");
    }
    await admin.from("whatsapp_fila").delete().eq("campanha_id", data.id).eq("status", "pendente");
    await admin.from("whatsapp_campanhas").update({ status: "cancelada" }).eq("id", data.id);
    return { ok: true };
  });
