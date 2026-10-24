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
}

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
    if (/ipad/i.test(ua) || dt.includes("ipad")) return "iPad";
    return "iPhone";
  }
  if (bucket === "android") {
    const build = ua.match(/;\s*([^;()]+?)\s+Build\//i);
    if (build) return build[1].trim();
    const dtModel = (deviceType ?? "").trim();
    if (dtModel && !/^(android|mobile|phone|celular)$/i.test(dtModel)) return dtModel;
    return null;
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
});

/**
 * Dispositivos que conectaram hoje (period_date = hoje em America/Sao_Paulo),
 * com o mesmo escopo de papel do getInsights: ADM vê tudo, matriz filtra por
 * empresa, filial por unidade. Os números vêm da tabela connections, que o
 * portal alimenta com device_type + user_agent a cada conexão.
 */
export const getDispositivosHoje = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DispositivosHoje> => {
    const { role, companyId, branchId } = (await resolveContext(
      context.supabase,
      context.userId,
    )) as { role: string | null; companyId: string | null; branchId: string | null };
    const periodDate = spDate();

    if (role !== "adm" && role !== "matriz" && role !== "filial") return vazio(periodDate);

    type Row = { device_type: string | null; user_agent: string | null };
    const rows: Row[] = [];
    for (let page = 0; page < 10; page++) {
      let query = context.supabase
        .from("connections")
        .select("device_type,user_agent")
        .eq("period_date", periodDate);
      if (role === "matriz" && companyId) query = query.eq("company_id", companyId);
      else if (role === "filial" && branchId) query = query.eq("branch_id", branchId);
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
    };
  });
