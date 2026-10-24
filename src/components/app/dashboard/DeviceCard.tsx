import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getDispositivosHoje, type DeviceModel } from "@/lib/device.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Smartphone, Laptop } from "lucide-react";

function ListaModelos({
  titulo,
  modelos,
  total,
  dotClass,
}: {
  titulo: string;
  modelos: DeviceModel[];
  total: number;
  dotClass: string;
}) {
  return (
    <div>
      <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <span className={`inline-block size-2.5 rounded-full ${dotClass}`} />
        {titulo}
        {modelos.length > 1 ? ` · ${total}` : ""}
      </p>
      {modelos.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum modelo ainda hoje.</p>
      ) : (
        <ul className="space-y-1.5">
          {modelos.map((m) => (
            <li key={m.modelo} className="flex items-center justify-between gap-2 text-sm">
              <span className="truncate font-medium">{m.modelo}</span>
              <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                {m.total}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Card "Dispositivos conectados hoje" da capa do ADM: celular vs computador,
 * com os modelos de celular que conectaram, separados por Android e iOS.
 * Atualiza a cada 5s, igual aos cards de "A plataforma hoje".
 * Os modelos vêm do user agent capturado no portal: Android traz o modelo
 * (ex.: SM-S918B, Pixel 8 Pro); iPhone/iPad não trazem modelo — só o tipo.
 */
// Dados fictícios só para visualização no preview (?demo=1). Nunca usados sem o
// parâmetro na URL, e o selo "Demonstração" deixa claro que não são reais.
const DEMO = {
  periodDate: "hoje",
  total: 28,
  celular: 23,
  computador: 5,
  outros: 0,
  android: 15,
  ios: 8,
  modelosAndroid: [
    { modelo: "Galaxy S23", total: 6 },
    { modelo: "Moto G54", total: 4 },
    { modelo: "Redmi Note 13", total: 3 },
    { modelo: "Pixel 8", total: 2 },
  ],
  modelosIos: [{ modelo: "iPhone", total: 8 }],
};

export function DeviceCard() {
  const demo =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("demo") === "1";
  const fetchDevices = useServerFn(getDispositivosHoje);
  const { data, isLoading } = useQuery({
    queryKey: ["dispositivos-hoje"],
    queryFn: () => fetchDevices(),
    enabled: !demo,
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
  });

  if (!demo && isLoading) return <Skeleton className="h-[260px] w-full rounded-xl" />;

  const dados = demo ? DEMO : data;
  const total = dados?.total ?? 0;
  const celular = dados?.celular ?? 0;
  const computador = dados?.computador ?? 0;
  const outros = dados?.outros ?? 0;
  const pctCelular = total > 0 ? Math.round((celular / total) * 100) : 0;
  const pctComputador = total > 0 ? Math.round((computador / total) * 100) : 0;

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle>Dispositivos conectados hoje</CardTitle>
        <p className="text-xs text-muted-foreground">
          Celular vs computador · modelos que conectaram, por sistema
        </p>
        {demo ? (
          <p className="mt-1 inline-flex rounded-full bg-amber-400/15 px-2 py-0.5 text-[11px] font-semibold text-amber-300">
            Demonstração · dados fictícios
          </p>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-5">
        {total === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum dispositivo conectou hoje ainda — assim que o primeiro cliente entrar, os
            modelos aparecem aqui.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-8">
              <div className="flex items-center gap-3">
                <Smartphone className="size-8 text-primary" />
                <div>
                  <p className="font-display text-4xl font-black tracking-tighter">{celular}</p>
                  <p className="text-xs font-medium text-muted-foreground">
                    Celular · {pctCelular}%
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Laptop className="size-8 text-primary" />
                <div>
                  <p className="font-display text-4xl font-black tracking-tighter">{computador}</p>
                  <p className="text-xs font-medium text-muted-foreground">
                    Computador · {pctComputador}%
                  </p>
                </div>
              </div>
              {outros > 0 ? (
                <div className="flex items-center">
                  <p className="text-sm text-muted-foreground">Outros: {outros}</p>
                </div>
              ) : null}
            </div>

            <div>
              <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
                {(dados?.android ?? 0) > 0 ? (
                  <div className="h-full bg-green-400" style={{ flexGrow: dados?.android ?? 0, flexBasis: 0 }} />
                ) : null}
                {(dados?.ios ?? 0) > 0 ? (
                  <div className="h-full bg-yellow-400" style={{ flexGrow: dados?.ios ?? 0, flexBasis: 0 }} />
                ) : null}
                {(dados?.computador ?? 0) > 0 ? (
                  <div className="h-full bg-blue-500" style={{ flexGrow: dados?.computador ?? 0, flexBasis: 0 }} />
                ) : null}
                {outros > 0 ? (
                  <div className="h-full bg-slate-500" style={{ flexGrow: outros, flexBasis: 0 }} />
                ) : null}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block size-2.5 rounded-full bg-green-400" /> Android {dados?.android ?? 0}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block size-2.5 rounded-full bg-yellow-400" /> iOS {dados?.ios ?? 0}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block size-2.5 rounded-full bg-blue-500" /> Computador {computador}
                </span>
                {outros > 0 ? (
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block size-2.5 rounded-full bg-slate-500" /> Outros {outros}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <ListaModelos
                titulo="Android"
                modelos={dados?.modelosAndroid ?? []}
                total={dados?.android ?? 0}
                dotClass="bg-green-400"
              />
              <ListaModelos
                titulo="iOS"
                modelos={dados?.modelosIos ?? []}
                total={dados?.ios ?? 0}
                dotClass="bg-yellow-400"
              />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
