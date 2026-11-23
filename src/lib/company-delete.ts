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

/**
 * Extrai o caminho de um objeto no Storage de um valor do banco que pode
 * ser URL (assinada ou pública — ex.: logo de empresa/filial, avatar) ou
 * caminho cru (ex.: banner_urls, logo_path de patrocinador, file_path de
 * anexo). Devolve null para URL externa ou valor inválido — nunca joga
 * erro. Usado pela exclusão de empresa (Frente 2), que precisa coletar
 * TODOS os caminhos antes da cascata apagar as linhas.
 */
export function extractStorageObjectPath(
  bucket: string,
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  const marker = `/${bucket}/`;
  const idx = value.indexOf(marker);
  // URL do bucket → caminho após o marcador; URL de outro lugar → null.
  if (idx >= 0) return cleanStoragePath(value.slice(idx + marker.length));
  if (value.includes("://")) return null;
  // Sem marcador e sem esquema → já é o caminho cru.
  return cleanStoragePath(value);
}

function cleanStoragePath(raw: string): string | null {
  const cut = raw.split(/[?#]/)[0] ?? "";
  if (!cut || cut.includes("..") || cut.includes("\\") || cut.startsWith("/")) {
    return null;
  }
  try {
    const decoded = decodeURIComponent(cut);
    return decoded ? decoded : null;
  } catch {
    return cut;
  }
}
