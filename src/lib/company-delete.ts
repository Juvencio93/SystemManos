/**
 * Extrai o caminho no Storage de uma URL do bucket campaign-assets
 * (assinada ou pública). A logo da empresa é salva como URL assinada
 * (`.../storage/v1/object/sign/campaign-assets/<caminho>?token=...`),
 * sem o id da empresa no caminho — por isso a exclusão precisa
 * extrair o caminho da URL em vez de listar por prefixo.
 * Devolve null quando a URL não é do bucket ou não dá para extrair.
 */
export function extractCampaignAssetPath(
  url: string | null | undefined,
): string | null {
  if (!url) return null;
  const marker = "/campaign-assets/";
  const idx = url.indexOf(marker);
  if (idx < 0) return null;
  const rest = url.slice(idx + marker.length);
  const raw = rest.split(/[?#]/)[0] ?? "";
  if (!raw) return null;
  try {
    const decoded = decodeURIComponent(raw);
    return decoded ? decoded : null;
  } catch {
    return raw;
  }
}
