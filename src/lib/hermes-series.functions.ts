import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import https from "node:https";

/**
 * Séries do Hermes (monitoramento das RBs) para a ficha da RB no mapa.
 *
 * Os dados vivem no Postgres do Hermes, na VPS — o painel NÃO consulta
 * esse banco direto. Quem busca é esta server function, chamando o
 * endpoint de leitura do serviço hermes-enroll (HTTPS :8443, token no
 * header). Assim: nada de egress novo no Supabase, nada roda em loop —
 * a consulta acontece só quando alguém abre a ficha de uma RB.
 *
 * Env (Vercel, server-side):
 *   HERMES_API_URL   ex.: https://186.202.57.104:8443
 *   HERMES_API_TOKEN mesmo valor de HERMES_PANEL_TOKEN no .env da VPS
 */

export interface HermesPonto {
  t: string;
  cpu: number | null;
  mem: number | null;
  clientes: number | null;
  temp: number | null;
  down: number | null;
  up: number | null;
}

export interface HermesAgora {
  cpu: number | null;
  memoria_pct: number | null;
  temperatura: number | null;
  uptime: string | null;
  clientes: number | null;
  acessivel: boolean;
  down_mbps: number | null;
  up_mbps: number | null;
  em: string;
}

export interface HermesProblema {
  regra: string;
  severidade: string;
  titulo: string;
  quando: string;
}

export type HermesRbResult =
  | {
      ok: true;
      rb: string;
      agora: HermesAgora | null;
      serie: HermesPonto[];
      problemas: HermesProblema[];
    }
  | { ok: false; erro: string };

function buscarJson(url: string, token: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: { "X-Hermes-Token": token },
        // Certificado autoassinado da VPS; a autenticação é o token.
        rejectUnauthorized: false,
        timeout: 10_000,
      },
      (res) => {
        const partes: Buffer[] = [];
        res.on("data", (c) => partes.push(c as Buffer));
        res.on("end", () =>
          resolve(Buffer.concat(partes).toString("utf-8")),
        );
      },
    );
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
  });
}

export const getHermesRbSeries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data) =>
    z
      .object({
        identity: z.string().min(1).max(80),
        horas: z.number().int().min(1).max(168).default(24),
      })
      .parse(data),
  )
  .handler(async ({ context, data }): Promise<HermesRbResult> => {
    const { supabase, userId } = context;
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();
    if (!roleData || !["adm", "matriz"].includes(roleData.role)) {
      return { ok: false, erro: "sem-permissao" };
    }

    const base = process.env["HERMES_API_URL"];
    const token = process.env["HERMES_API_TOKEN"];
    if (!base || !token) return { ok: false, erro: "nao-configurado" };

    const url =
      `${base.replace(/\/$/, "")}/rb-series` +
      `?identity=${encodeURIComponent(data.identity)}&horas=${data.horas}`;
    try {
      const corpo = await buscarJson(url, token);
      const json = JSON.parse(corpo) as HermesRbResult & { erro?: string };
      if (!json || typeof json !== "object" || !("ok" in json)) {
        return { ok: false, erro: "indisponivel" };
      }
      return json;
    } catch {
      return { ok: false, erro: "indisponivel" };
    }
  });
