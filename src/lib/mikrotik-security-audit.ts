export type MikrotikSecurityFinding = { level: "warning" | "ok"; message: string };

export function analyzeMikrotikSecurityAudit(output: string) {
  const rows = output.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.startsWith("MANOS-SECURITY|"));
  const begin = rows.find((row) => row === "MANOS-SECURITY|BEGIN|1" || row === "MANOS-SECURITY|BEGIN|2");`n  const end = rows.find((row) => row === "MANOS-SECURITY|END|1" || row === "MANOS-SECURITY|END|2");`n  if (!begin || !end) {
    return { valid: false, findings: [{ level: "warning" as const, message: "Cole a saída completa do diagnóstico, do BEGIN ao END." }] };
  }
  const fields = rows.map((line) => line.split("|"));
  const findings: MikrotikSecurityFinding[] = [];
  const ipv6 = fields.find((row) => row[1] === "IPV6")?.[2];
  findings.push(ipv6 === "false"
    ? { level: "ok", message: "IPv6 desativado." }
    : { level: "warning", message: ipv6 === "true" ? "IPv6 está ativo: confira firewall IPv6 antes de usá-lo." : "Não foi possível confirmar IPv6 nesta RB." });
  const services = fields.filter((row) => row[1] === "SERVICE");
  const exposed = services.filter((row) => row[3] === "true").map((row) => row[2]);
  findings.push(exposed.length
    ? { level: "warning", message: `Serviços ativos: ${exposed.join(", ")}. Mantenha somente os necessários.` }
    : { level: "ok", message: "Nenhum serviço IP de administração ativo foi identificado." });
  const users = fields.filter((row) => row[1] === "USER");
  findings.push({ level: "warning", message: `Contas locais: ${users.map((row) => `${row[2]} (${row[3]})`).join(", ") || "nenhuma"}. Revise contas desconhecidas.` });
  const backup = fields.find((row) => row[1] === "BACKUP")?.[2];
  findings.push(backup === "true" ? { level: "ok", message: "Exportação Manos encontrada na RB." } : { level: "warning", message: "Nenhuma exportação Manos encontrada. Gere uma antes de alterar a rede." });
  findings.push({ level: "warning", message: "Isolamento de clientes no ponto de acesso exige conferência manual no AP ou controlador Wi-Fi." });
  return { valid: true, findings };
}
