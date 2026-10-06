type Finding = { level: "blocker" | "warning" | "ok"; message: string };

export type MikrotikPostflightReport = { valid: boolean; findings: Finding[] };

const expectedBridges: Record<string, string> = {
  ether1: "bridge-wan",
  ether2: "bridge-lan",
  ether3: "bridge-lan",
  ether4: "bridge-livre",
  ether5: "bridge-wan",
};

export function analyzeMikrotikPostflight(output: string): MikrotikPostflightReport {
  const rows = output.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.startsWith("MANOS-POSTFLIGHT|"));
  if (!rows.includes("MANOS-POSTFLIGHT|BEGIN|1") || !rows.includes("MANOS-POSTFLIGHT|END|1")) {
    return { valid: false, findings: [{ level: "blocker", message: "Cole a saída completa do diagnóstico, do BEGIN ao END." }] };
  }

  const fields = rows.map((line) => line.split("|"));
  const findings: Finding[] = [];
  for (const [port, expected] of Object.entries(expectedBridges)) {
    const actual = fields.find((row) => row[1] === "PORT" && row[2] === port)?.[3];
    findings.push(actual === expected
      ? { level: "ok", message: `${port}: ${expected}.` }
      : { level: "blocker", message: `${port} está em ${actual ?? "estado desconhecido"}; o esperado é ${expected}.` });
  }
  for (const [address, expectedBridge] of [["192.168.88.1/24", "bridge-lan"], ["192.168.89.1/24", "bridge-livre"]] as const) {
    const actual = fields.find((row) => row[1] === "ADDRESS" && row[2] === address)?.[3];
    findings.push(actual === expectedBridge
      ? { level: "ok", message: `${address} em ${expectedBridge}.` }
      : { level: "blocker", message: `${address} não está em ${expectedBridge}.` });
  }
  const queue = fields.find((row) => row[1] === "QUEUE" && row[2] === "MANOS-ETHER4-TOTAL");
  findings.push(queue?.[3] === "192.168.89.0/24" && queue?.[4] === "60M/60M"
    ? { level: "ok", message: "ether4: fila total 60/60 Mbps ativa." }
    : { level: "blocker", message: "ether4: fila MANOS-ETHER4-TOTAL 60/60 Mbps não foi confirmada." });
  const radius = fields.find((row) => row[1] === "RADIUS")?.[2];
  findings.push(radius === "true" ? { level: "ok", message: "RADIUS do HotSpot ativo." } : { level: "blocker", message: "RADIUS do HotSpot não foi confirmado." });
  const hotspot = fields.find((row) => row[1] === "HOTSPOT")?.[2];
  findings.push(hotspot === "bridge-lan" ? { level: "ok", message: "HotSpot ativo somente em bridge-lan (ether2/ether3)." } : { level: "blocker", message: "HotSpot não foi confirmado em bridge-lan." });
  const login = fields.find((row) => row[1] === "LOGIN")?.[2];
  findings.push(login === "true" ? { level: "ok", message: "Página de login Manos Tech confirmada." } : { level: "warning", message: "Página de login ainda não foi confirmada. Solicite uma sincronização e confira novamente." });
  for (const rule of ["MANOS-ISOLATE-HOTSPOT-LIVRE", "MANOS-ISOLATE-LIVRE-HOTSPOT"]) {
    const active = fields.find((row) => row[1] === "ISOLATION" && row[2] === rule)?.[3];
    findings.push(active === "true" ? { level: "ok", message: `Isolamento ${rule} ativo.` } : { level: "blocker", message: `Regra de isolamento ${rule} não foi confirmada.` });
  }
  findings.push({ level: "warning", message: "Faça um teste de navegação no visitante e um teste de velocidade no dispositivo conectado; a RB não mede a velocidade percebida pelo cliente." });
  return { valid: true, findings };
}
