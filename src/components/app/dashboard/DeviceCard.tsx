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
}: {
  titulo: string;
  modelos: DeviceModel[];
  total: number;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {titulo} · {total}
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
export function DeviceCard() {
  const fetchDevices = useServerFn(getDispositivosHoje);
  const { data, isLoading } = useQuery({
    queryKey: ["dispositivos-hoje"],
    queryFn: () => fetchDevices(),
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
  });

  if (isLoading) return <Skeleton className="h-[260px] w-full rounded-xl" />;

  const total = data?.total ?? 0;
  const celular = data?.celular ?? 0;
  const computador = data?.computador ?? 0;
  const outros = data?.outros ?? 0;
  const pctCelular = total > 0 ? Math.round((celular / total) * 100) : 0;
  const pctComputador = total > 0 ? Math.round((computador / total) * 100) : 0;

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle>Dispositivos conectados hoje</CardTitle>
        <p className="text-xs text-muted-foreground">
          Celular vs computador · modelos que conectaram, por sistema
        </p>
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

            <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-primary" style={{ width: `${pctCelular}%` }} />
              <div className="h-full bg-cyan-400" style={{ width: `${pctComputador}%` }} />
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <ListaModelos
                titulo="Android"
                modelos={data?.modelosAndroid ?? []}
                total={data?.android ?? 0}
              />
              <ListaModelos titulo="iOS" modelos={data?.modelosIos ?? []} total={data?.ios ?? 0} />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
