/**
 * Gera o script RouterOS que sincroniza os MACs liberados (bypass do portal).
 * Para cada MAC na lista, garante um /ip hotspot ip-binding type=bypassed
 * com comentário MANOS-BYPASS. Remove bindings gerenciados que saíram da lista.
 * Bindings manuais (sem o comentário) nunca são tocados.
 */
export function macBypassCommand(macs: string[]): string {
  const prefix = "MANOS-BYPASS";
  const lines: string[] = [];
  lines.push(`# Sincroniza dispositivos liberados (MAC bypass)`);
  // Garante cada MAC da lista
  for (const mac of macs) {
    const upper = mac.toUpperCase();
    lines.push(
      `:if ([:len [/ip hotspot ip-binding find where mac-address="${upper}" comment="${prefix}"]] = 0) do={` +
        ` /ip hotspot ip-binding add mac-address="${upper}" type=bypassed comment="${prefix}"` +
        ` }`,
    );
  }
  // Remove gerenciados que não estão mais na lista
  const macList = macs.map((m) => `"${m.toUpperCase()}"`).join(";");
  lines.push(
    `:foreach b in=[/ip hotspot ip-binding find where comment="${prefix}"] do={` +
      ` :local bmac [/ip hotspot ip-binding get $b mac-address];` +
      ` :local keep false;` +
      ` :foreach m in={${macList}} do={ :if ($bmac = $m) do={ :set keep true } };` +
      ` :if ($keep = false) do={ /ip hotspot ip-binding remove $b }` +
      ` }`,
  );
  return lines.join("\n") + "\n";
}
