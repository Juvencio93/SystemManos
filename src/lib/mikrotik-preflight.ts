type Finding = { level: "blocker" | "warning" | "ok"; message: string };

export type MikrotikPreflightReport = {
  valid: boolean;
  findings: Finding[];
};

const expectedBridges: Record<string, string> = {
  ether1: "bridge-wan",
  ether2: "bridge-lan",
  ether3: "bridge-lan",
  ether4: "bridge-livre",
  ether5: "bridge-wan",
};

function ipv4Cidr(value: string) {
  const [address, prefixText] = value.split("/");
  const octets = address?.split(".").map(Number);
  const prefix = Number(prefixText);
  if (!octets || octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255) ||
      !Number.isInteger(prefix) || prefix < 0 || prefix > 32) return null;
  const ip = (((octets[0]! << 24) | (octets[1]! << 16) | (octets[2]! << 8) | octets[3]!) >>> 0);
  return { ip, prefix };
}

function overlaps(first: string, second: string) {
  const a = ipv4Cidr(first);
  const b = ipv4Cidr(second);
  if (!a || !b) return false;
  const commonPrefix = Math.min(a.prefix, b.prefix);
  const mask = commonPrefix === 0 ? 0 : (0xffffffff << (32 - commonPrefix)) >>> 0;
  return (a.ip & mask) === (b.ip & mask);
}

export function analyzeMikrotikPreflight(output: string): MikrotikPreflightReport {
  const rows = output.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.startsWith("MANOS-PREFLIGHT|"));
  if (!rows.includes("MANOS-PREFLIGHT|BEGIN|1") || !rows.includes("MANOS-PREFLIGHT|END|1")) {
    return { valid: false, findings: [{ level: "blocker", message: "Cole a saída completa do diagnóstico, do BEGIN ao END." }] };
  }

  const fields = rows.map((line) => line.split("|"));
  const findings: Finding[] = [];
  const version = fields.find((row) => row[1] === "VERSION")?.[2] ?? "";
  if (!/^7\./.test(version)) findings.push({ level: "blocker", message: `RouterOS ${version || "não identificado"}: o kit requer a versão 7.` });
  else findings.push({ level: "ok", message: `RouterOS ${version} identificado.` });

  for (const [port, expected] of Object.entries(expectedBridges)) {
    const actual = fields.find((row) => row[1] === "PORT" && row[2] === port)?.[3];
    if (!actual || actual === "missing") {
      findings.push({ level: "blocker", message: `${port} não foi identificada na RB.` });
    } else if (actual !== "none" && actual !== expected) {
      findings.push({ level: "blocker", message: `${port} está em ${actual}; o kit espera ${expected}. Revise antes da importação.` });
    } else {
      findings.push({ level: "ok", message: `${port}: ${actual === "none" ? "disponível" : expected}.` });
    }
  }

  for (const row of fields.filter((entry) => entry[1] === "ADDRESS")) {
    const address = row[2] ?? "";
    const networkInterface = row[3] ?? "";
    for (const [network, expectedAddress, expectedInterface] of [
      ["192.168.88.0/24", "192.168.88.1/24", "bridge-lan"],
      ["192.168.89.0/24", "192.168.89.1/24", "bridge-livre"],
    ] as const) {
      if (overlaps(address, network) && (address !== expectedAddress || networkInterface !== expectedInterface)) {
        findings.push({ level: "blocker", message: `${address} em ${networkInterface} conflita com a rede ${network} do kit.` });
      }
    }
  }

  for (const row of fields.filter((entry) => entry[1] === "DHCP-CLIENT")) {
    if (row[2] !== "bridge-wan") findings.push({ level: "blocker", message: `Cliente DHCP ativo em ${row[2]}; o kit usa bridge-wan para a WAN.` });
  }
  if (fields.some((row) => row[1] === "PPPOE")) {
    findings.push({ level: "blocker", message: "Há PPPoE ativo; o kit atual pressupõe WAN por DHCP." });
  }
  for (const row of fields.filter((entry) => entry[1] === "DHCP-SERVER")) {
    if (!((row[2] === "dhcp-lan" && row[3] === "bridge-lan") ||
          (row[2] === "dhcp-livre" && row[3] === "bridge-livre"))) {
      findings.push({ level: "blocker", message: `Servidor DHCP ${row[2]} ativo em ${row[3]}; o kit pode criar um segundo servidor.` });
    }
  }
  for (const row of fields.filter((entry) => entry[1] === "HOTSPOT")) {
    if (row[2] !== "hotspot1" || row[3] !== "bridge-lan") {
      findings.push({ level: "blocker", message: `HotSpot ${row[2]} ativo em ${row[3]}; o kit cria hotspot1 em bridge-lan.` });
    }
  }
  if (!fields.some((row) => row[1] === "DHCP-CLIENT")) {
    findings.push({ level: "warning", message: "Nenhum cliente DHCP WAN ativo. Confirme que o provedor fornece IP por DHCP." });
  }
  if (!findings.some((finding) => finding.level === "blocker")) {
    findings.push({ level: "warning", message: "A leitura não substitui o backup e a conferência da conexão do provedor e das impressoras." });
  }
  return { valid: true, findings };
}
