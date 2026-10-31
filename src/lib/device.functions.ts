import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { classifyDevice, spDate, type DeviceBucket } from "@/lib/insights.server";
import { resolveContext } from "@/lib/insights.functions";

export interface DeviceModel {
  modelo: string;
  total: number;
}

export interface DispositivosHoje {
  periodDate: string;
  total: number;
  celular: number;
  computador: number;
  outros: number;
  android: number;
  ios: number;
  modelosAndroid: DeviceModel[];
  modelosIos: DeviceModel[];
  modelosComputador: DeviceModel[];
}

/**
 * Códigos internos de modelo mapeados para o nome comercial amigável exibido
 * no dashboard. O user agent traz o código interno no token antes de "Build/"
 * (ex.: Xiaomi/Redmi/POCO) — sem o mapa, o dashboard mostra "24090RA29G" em
 * vez de "Redmi Note 14 Pro 5G". Mapa extensível: adicionar novos códigos aqui.
 */
const MODEL_FRIENDLY_NAMES: Record<string, string> = {
  // 24090RA29G — Redmi Note 14 Pro 5G (também vendido como POCO X7)
  "24090RA29G": "Redmi Note 14 Pro 5G",
};

/**
 * Extrai o modelo do aparelho a partir do user agent capturado no portal.
 * Android: o token antes de "Build/" (ex.: "SM-S918B", "Pixel 8 Pro").
 * iOS: o user agent nunca traz o modelo — só "iPhone" ou "iPad".
 * Retorna null quando não dá para identificar (conta como "Não identificado").
 */
function extractModel(
  bucket: DeviceBucket,
  deviceType: string | null,
  userAgent: string | null,
): string | null {
  const ua = userAgent ?? "";
  const dt = (deviceType ?? "").toLowerCase();
  if (bucket === "ios") {
    const dtOrig = (deviceType ?? "").trim();
    // Se o device_type traz o modelo específico (ex: "iPhone 11"), usa ele
    if (dtOrig && /iphone/i.test(dtOrig) && !/^(iphone|ipad)$/i.test(dtOrig)) return dtOrig;
    if (/ipad/i.test(ua) || /ipad/i.test(dtOrig)) return "iPad";
    return "iPhone";
  }
  if (bucket === "android") {
    const build = ua.match(/;\s*([^;()]+?)\s+Build\//i);
    const modelo = build?.[1]?.trim();
    // Código interno (ex.: Xiaomi) → nome comercial amigável
    if (modelo) return MODEL_FRIENDLY_NAMES[modelo] ?? modelo;
    const dtModel = (deviceType ?? "").trim();
    if (dtModel && !/^(android|mobile|phone|celular)$/i.test(dtModel)) return dtModel;
    return null;
  }
  if (bucket === "desktop") {
    if (/windows/i.test(ua)) return "Windows";
    if (/macintosh|mac os/i.test(ua)) return "macOS";
    if (/linux/i.test(ua)) return "Linux";
    const dt = (deviceType ?? "").trim();
    if (dt) return dt;
    return "Computador";
  }
  return null;
}

function topModelos(mapa: Map<string, number>): DeviceModel[] {
  return [...mapa.entries()]
    .map(([modelo, total]) => ({ modelo, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);
}

const vazio = (periodDate: string): DispositivosHoje => ({
  periodDate,
  total: 0,
  celular: 0,
  computador: 0,
  outros: 0,
  android: 0,
  ios: 0,
  modelosAndroid: [],
  modelosIos: [],
  modelosComputador: [],
});

/**
 * Dispositivos que conectaram hoje (period_date = hoje em America/Sao_Paulo).
 * Escopo por papel: ADM vê tudo; matriz filtra por empresa (inclui as filiais,
 * que compartilham o company_id); filial só pela própria unidade; revenda
 * pela rede dele (empresas e unidades com reseller_id igual ao dele).
 * Os números vêm da tabela connections, que o portal alimenta com
 * device_type + user_agent a cada conexão.
 */
export const getDispositivosHoje = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DispositivosHoje> => {
    const { role, companyId, branchId } = (await resolveContext(
      context.supabase,
      context.userId,
    )) as { role: string | null; companyId: string | null; branchId: string | null };
    const periodDate = spDate();

    if (role !== "adm" && role !== "matriz" && role !== "filial" && role !== "revenda") {
      return vazio(periodDate);
    }

    // Rede da revenda: empresas e unidades com reseller_id igual ao dela.
    let resellerCompanyIds: string[] = [];
    let resellerBranchIds: string[] = [];
    if (role === "revenda") {
      const { data: roleRow } = await context.supabase
        .from("user_roles")
        .select("reseller_id")
        .eq("user_id", context.userId)
        .maybeSingle();
      const resellerId = (roleRow as { reseller_id: string | null } | null)?.reseller_id;
      if (!resellerId) return vazio(periodDate);
      const [{ data: companies }, { data: branches }] = await Promise.all([
        context.supabase.from("companies").select("id").eq("reseller_id", resellerId),
        context.supabase.from("branches").select("id").eq("reseller_id", resellerId),
      ]);
      resellerCompanyIds = ((companies ?? []) as { id: string }[]).map((row) => row.id);
      resellerBranchIds = ((branches ?? []) as { id: string }[]).map((row) => row.id);
      if (!resellerCompanyIds.length && !resellerBranchIds.length) return vazio(periodDate);
    }

    type Row = { device_type: string | null; user_agent: string | null };
    const rows: Row[] = [];
    for (let page = 0; page < 10; page++) {
      let query = context.supabase
        .from("connections")
        .select("device_type,user_agent")
        .eq("period_date", periodDate);
      if (role === "matriz" && companyId) query = query.eq("company_id", companyId);
      else if (role === "filial" && branchId) query = query.eq("branch_id", branchId);
      else if (role === "revenda") {
        const filtros = [
          ...(resellerCompanyIds.length
            ? [`company_id.in.(${resellerCompanyIds.join(",")})`]
            : []),
          ...(resellerBranchIds.length
            ? [`branch_id.in.(${resellerBranchIds.join(",")})`]
            : []),
        ];
        query = query.or(filtros.join(","));
      }
      const { data, error } = await query.range(page * 1000, page * 1000 + 999);
      if (error) throw error;
      rows.push(...((data ?? []) as Row[]));
      if (!data || data.length < 1000) break;
    }

    let celular = 0;
    let computador = 0;
    let outros = 0;
    let android = 0;
    let ios = 0;
    const modelosAndroid = new Map<string, number>();
    const modelosIos = new Map<string, number>();
    const modelosComputador = new Map<string, number>();

    for (const row of rows) {
      const bucket = classifyDevice(row.device_type, row.user_agent);
      if (bucket === "android" || bucket === "ios") {
        celular += 1;
        if (bucket === "android") android += 1;
        else ios += 1;
        const modelo = extractModel(bucket, row.device_type, row.user_agent) ?? "Não identificado";
        const mapa = bucket === "android" ? modelosAndroid : modelosIos;
        mapa.set(modelo, (mapa.get(modelo) ?? 0) + 1);
      } else if (bucket === "desktop") {
        computador += 1;
        const modelo = extractModel(bucket, row.device_type, row.user_agent) ?? "Computador";
        modelosComputador.set(modelo, (modelosComputador.get(modelo) ?? 0) + 1);
      } else {
        outros += 1;
      }
    }

    return {
      periodDate,
      total: rows.length,
      celular,
      computador,
      outros,
      android,
      ios,
      modelosAndroid: topModelos(modelosAndroid),
      modelosIos: topModelos(modelosIos),
      modelosComputador: topModelos(modelosComputador),
    };
  });

export interface ConectadosAgoraDevices {
  celular: number;
  computador: number;
}

/**
 * Breakdown dos conectados AGORA (últimos 15 min, mesma janela do
 * `conectadosAgora` do insights) por tipo de aparelho — celular vs computador.
 * Escopo por papel, igual ao getDispositivosHoje.
 */
export const getConectadosAgoraDevices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ConectadosAgoraDevices> => {
    const { role, companyId, branchId } = (await resolveContext(
      context.supabase,
      context.userId,
    )) as { role: string | null; companyId: string | null; branchId: string | null };

    if (role !== "adm" && role !== "matriz" && role !== "filial" && role !== "revenda") {
      return { celular: 0, computador: 0 };
    }

    let resellerCompanyIds: string[] = [];
    let resellerBranchIds: string[] = [];
    if (role === "revenda") {
      const { data: roleRow } = await context.supabase
        .from("user_roles")
        .select("reseller_id")
        .eq("user_id", context.userId)
        .maybeSingle();
      const resellerId = (roleRow as { reseller_id: string | null } | null)?.reseller_id;
      if (!resellerId) return { celular: 0, computador: 0 };
      const [{ data: companies }, { data: branches }] = await Promise.all([
        context.supabase.from("companies").select("id").eq("reseller_id", resellerId),
        context.supabase.from("branches").select("id").eq("reseller_id", resellerId),
      ]);
      resellerCompanyIds = ((companies ?? []) as { id: string }[]).map((row) => row.id);
      resellerBranchIds = ((branches ?? []) as { id: string }[]).map((row) => row.id);
      if (!resellerCompanyIds.length && !resellerBranchIds.length) return { celular: 0, computador: 0 };
    }

    const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    type Row = { device_type: string | null; user_agent: string | null };
    let query = context.supabase
      .from("connections")
      .select("device_type,user_agent")
      .gte("created_at", since);
    if (role === "matriz" && companyId) query = query.eq("company_id", companyId);
    else if (role === "filial" && branchId) query = query.eq("branch_id", branchId);
    else if (role === "revenda") {
      const filtros = [
        ...(resellerCompanyIds.length ? [`company_id.in.(${resellerCompanyIds.join(",")})`] : []),
        ...(resellerBranchIds.length ? [`branch_id.in.(${resellerBranchIds.join(",")})`] : []),
      ];
      query = query.or(filtros.join(","));
    }
    const { data, error } = await query.limit(2000);
    if (error) throw error;

    let celular = 0;
    let computador = 0;
    for (const row of (data ?? []) as Row[]) {
      const bucket = classifyDevice(row.device_type, row.user_agent);
      if (bucket === "android" || bucket === "ios") celular += 1;
      else if (bucket === "desktop") computador += 1;
    }
    return { celular, computador };
  });
