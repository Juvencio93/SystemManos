import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  getHermesRbSeries,
  type HermesRbResult,
} from "@/lib/hermes-series.functions";

/**
 * Seção "Monitoramento Hermes" da ficha da RB no mapa da rede:
 * status atual + gráficos de 24h (CPU, tráfego, clientes) + problemas
 * detectados. Os dados vêm do Hermes (VPS) via server function — a
 * consulta só acontece quando a ficha é aberta.
 */

type Estado =
  | { fase: "carregando" }
  | { fase: "oculto" }
  | { fase: "aviso"; texto: string }
  | { fase: "pronto"; dados: Extract<HermesRbResult, { ok: true }> };

function horaCurta(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function quandoCurto(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("pt-BR");
}

const COR_SEVERIDADE: Record<string, string> = {
  critica: "text-red-400",
  alta: "text-orange-400",
  media: "text-amber-300",
};

function MiniGrafico({
  titulo,
  dados,
  series,
  dominio,
  unidade,
}: {
  titulo: string;
  dados: { rotulo: string; [k: string]: string | number | null }[];
  series: { chave: string; nome: string; cor: string }[];
  dominio?: [number, number];
  unidade: string;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-3">
      <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {titulo}
      </p>
      <ResponsiveContainer width="100%" height={130}>
        <AreaChart data={dados} margin={{ top: 4, right: 6, bottom: 0, left: -18 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis
            dataKey="rotulo"
            tick={{ fill: "#94a3b8", fontSize: 10 }}
            tickLine={false}
            axisLine={{ stroke: "#1e293b" }}
            minTickGap={40}
          />
          <YAxis
            domain={dominio ?? ["auto", "auto"]}
            tick={{ fill: "#94a3b8", fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            unit={unidade}
          />
          <Tooltip
            contentStyle={{
              background: "#0b1220",
              border: "1px solid rgba(255,255,255,.12)",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: "#e2e8f0" }}
            formatter={(value, name) => [
              `${value ?? "—"}${unidade}`,
              String(name),
            ]}
          />
          {series.map((s) => (
            <Area
              key={s.chave}
              type="monotone"
              dataKey={s.chave}
              name={s.nome}
              stroke={s.cor}
              fill={s.cor}
              fillOpacity={0.14}
              strokeWidth={1.6}
              connectNulls
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function RbHermesPanel({ identity }: { identity: string }) {
  const buscar = useServerFn(getHermesRbSeries);
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });

  useEffect(() => {
    let vivo = true;
    setEstado({ fase: "carregando" });
    buscar({ data: { identity, horas: 24 } })
      .then((res) => {
        if (!vivo) return;
        if (res.ok) {
          setEstado({ fase: "pronto", dados: res });
        } else if (
          res.erro === "nao-configurado" ||
          res.erro === "sem-permissao"
        ) {
          setEstado({ fase: "oculto" });
        } else if (res.erro.includes("nao encontrada")) {
          setEstado({
            fase: "aviso",
            texto: "Esta RB ainda não é monitorada pelo Hermes.",
          });
        } else if (res.erro === "indisponivel") {
          setEstado({
            fase: "aviso",
            texto:
              "Não consegui falar com o Hermes na VPS." +
              (res.detalhe ? ` (${res.detalhe})` : ""),
          });
        } else {
          setEstado({
            fase: "aviso",
            texto: `O Hermes respondeu: ${res.erro}`,
          });
        }
      })
      .catch(() => {
        if (vivo)
          setEstado({
            fase: "aviso",
            texto: "Não consegui falar com o Hermes na VPS.",
          });
      });
    return () => {
      vivo = false;
    };
  }, [identity, buscar]);

  if (estado.fase === "oculto") return null;

  return (
    <div className="mt-4">
      <div className="flex items-center gap-2">
        <Activity className="size-4 text-primary" />
        <h4 className="text-sm font-semibold">Monitoramento Hermes</h4>
        {estado.fase === "pronto" && estado.dados.agora ? (
          <span className="text-[11px] text-muted-foreground">
            · atualizado {quandoCurto(estado.dados.agora.em)}
          </span>
        ) : null}
      </div>

      {estado.fase === "carregando" ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Carregando dados do Hermes…
        </p>
      ) : null}

      {estado.fase === "aviso" ? (
        <p className="mt-3 text-xs text-amber-300">{estado.texto}</p>
      ) : null}

      {estado.fase === "pronto" ? (
        <ConteudoHermes dados={estado.dados} />
      ) : null}
    </div>
  );
}

function ConteudoHermes({
  dados,
}: {
  dados: Extract<HermesRbResult, { ok: true }>;
}) {
  const [problemasAbertos, setProblemasAbertos] = useState(false);
  const agora = dados.agora;
  const pontos = dados.serie.map((p) => ({
    rotulo: horaCurta(p.t),
    cpu: p.cpu,
    mem: p.mem,
    clientes: p.clientes,
    down: p.down,
    up: p.up,
  }));

  const cartoes: { rotulo: string; valor: string }[] = agora
    ? [
        { rotulo: "CPU agora", valor: agora.cpu == null ? "—" : `${agora.cpu}%` },
        {
          rotulo: "Memória",
          valor: agora.memoria_pct == null ? "—" : `${agora.memoria_pct}%`,
        },
        {
          rotulo: "Temperatura",
          valor: agora.temperatura == null ? "—" : `${agora.temperatura}°C`,
        },
        { rotulo: "Uptime", valor: agora.uptime ?? "—" },
        {
          rotulo: "Clientes",
          valor: agora.clientes == null ? "—" : String(agora.clientes),
        },
        {
          rotulo: "Download",
          valor: agora.down_mbps == null ? "—" : `${agora.down_mbps} Mbps`,
        },
        {
          rotulo: "Upload",
          valor: agora.up_mbps == null ? "—" : `${agora.up_mbps} Mbps`,
        },
        {
          rotulo: "Coleta Hermes",
          valor: agora.acessivel ? "Respondendo" : "Sem resposta",
        },
      ]
    : [];

  return (
    <>
      {agora ? (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {cartoes.map((c) => (
            <div
              key={c.rotulo}
              className="rounded-lg border border-white/10 bg-black/20 px-3 py-2"
            >
              <p className="text-[11px] text-muted-foreground">{c.rotulo}</p>
              <p className="truncate text-sm font-semibold">{c.valor}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">
          Sem coletas do Hermes nas últimas 24h para esta RB.
        </p>
      )}

      {pontos.length > 1 ? (
        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          <MiniGrafico
            titulo="CPU — últimas 24h"
            dados={pontos}
            series={[{ chave: "cpu", nome: "CPU", cor: "#38bdf8" }]}
            dominio={[0, 100]}
            unidade="%"
          />
          <MiniGrafico
            titulo="Tráfego WAN — últimas 24h"
            dados={pontos}
            series={[
              { chave: "down", nome: "Download", cor: "#38bdf8" },
              { chave: "up", nome: "Upload", cor: "#34d399" },
            ]}
            unidade=" Mbps"
          />
          <MiniGrafico
            titulo="Clientes conectados — 24h"
            dados={pontos}
            series={[{ chave: "clientes", nome: "Clientes", cor: "#fbbf24" }]}
            unidade=""
          />
        </div>
      ) : null}

      <div className="mt-3 rounded-lg border border-white/10 bg-black/20">
        <button
          type="button"
          onClick={() => setProblemasAbertos((v) => !v)}
          aria-expanded={problemasAbertos}
          className="flex w-full items-center gap-2 p-3 text-left"
        >
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Problemas detectados (7 dias)
          </span>
          {dados.problemas.length ? (
            <span className="rounded-full bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-amber-300">
              {Math.min(dados.problemas.length, 5)}
            </span>
          ) : null}
          <ChevronDown
            className={`ml-auto size-4 shrink-0 text-muted-foreground transition-transform duration-200 ${problemasAbertos ? "rotate-180" : ""}`}
          />
        </button>
        {problemasAbertos ? (
          <div className="border-t border-white/10 px-3 pb-3 pt-2.5">
            {dados.problemas.length ? (
              <ul className="space-y-1.5">
                {dados.problemas.slice(0, 5).map((p, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs">
                    <AlertTriangle
                      className={`mt-0.5 size-3.5 shrink-0 ${COR_SEVERIDADE[p.severidade] ?? "text-amber-300"}`}
                    />
                    <span className="min-w-0">
                      <span className="text-foreground">{p.titulo}</span>{" "}
                      <span className="text-muted-foreground">
                        · {quandoCurto(p.quando)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <CheckCircle2 className="size-3.5 text-emerald-400" />
                Nenhum problema registrado nos últimos 7 dias.
              </p>
            )}
          </div>
        ) : null}
      </div>
    </>
  );
}
