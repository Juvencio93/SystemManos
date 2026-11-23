/**
 * Caminho de um objeto no Storage a partir de uma URL pública ou
 * assinada, ou do caminho cru quando a entrada já é um caminho.
 *
 * Extrai pelo marcador `/<bucket>/`, tira query/hash e decodifica
 * (ex.: `.../storage/v1/object/sign/campaign-assets/users/u1/logo.png?token=...`
 * vira `users/u1/logo.png`). Entrada que já é caminho cru (sem `://`)
 * é devolvida como está, após validação básica. Devolve null quando
 * a entrada não é do bucket ou não dá para extrair — nunca joga erro.
 */
export type StoredAssetBucket = "campaign-assets" | "brand-assets" | "chat-avatars";

export function extractStoragePath(
  bucket: StoredAssetBucket,
  urlOrPath: string | null | undefined,
): string | null {
  if (!urlOrPath) return null;
  const marker = `/${bucket}/`;
  const idx = urlOrPath.indexOf(marker);
  if (idx >= 0) {
    return cleanPath(urlOrPath.slice(idx + marker.length));
  }
  // Sem marcador e sem :// → já é um caminho cru no bucket.
  if (urlOrPath.includes("://")) return null;
  const raw = cleanPath(urlOrPath);
  if (!raw) return null;
  // Tolerar o nome do bucket como prefixo do caminho cru.
  if (raw.startsWith(`${bucket}/`)) return raw.slice(bucket.length + 1) || null;
  return raw;
}

function cleanPath(raw: string): string | null {
  const cut = raw.split(/[?#]/)[0] ?? "";
  if (!cut || cut.includes("..") || cut.includes("\\") || cut.startsWith("/")) return null;
  try {
    const decoded = decodeURIComponent(cut);
    return decoded ? decoded : null;
  } catch {
    return cut;
  }
}
