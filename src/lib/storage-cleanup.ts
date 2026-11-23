import { replaceStoredAsset } from "@/lib/storage.functions";
import type { StoredAssetBucket } from "@/lib/storage-path";

/**
 * Apaga o arquivo antigo do Storage depois de uma troca, sem nunca
 * quebrar o fluxo do usuário: fire-and-forget — a chamada ao servidor
 * roda em segundo plano e qualquer falha só é logada. O velho é lixo
 * órfão (o novo já foi salvo); travar a tela por ele seria pior que
 * deixá-lo para a varredura periódica de órfãos.
 *
 * Ignora oldPath vazio e o caso em que velho e novo são o mesmo
 * caminho (nada para apagar).
 */
export function removeReplacedAsset(
  bucket: StoredAssetBucket,
  oldPath: string | null | undefined,
  newPath?: string | null,
): void {
  if (!oldPath) return;
  if (newPath != null && newPath === oldPath) return;
  void replaceStoredAsset({ data: { bucket, oldPath, newPath: newPath ?? null } }).catch(
    (error: unknown) => {
      console.warn("[removeReplacedAsset] Falha ao remover arquivo antigo:", error);
    },
  );
}
