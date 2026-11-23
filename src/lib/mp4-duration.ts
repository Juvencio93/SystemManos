/**
 * Duração de um MP4 lida do cabeçalho do arquivo (Frente 5).
 *
 * O servidor não decodifica vídeo (sem ffmpeg/sharp no runtime): lê o
 * átomo `mvhd` dentro de `moov`, que todo MP4 válido carrega com
 * `timescale` + `duration`. Puro TypeScript, sem dependência nova.
 *
 * Devolve a duração em segundos ou `null` quando o arquivo não é um MP4
 * parseável (corrompido, truncado, `moov` ausente). `null` NÃO significa
 * "vídeo inválido" — o chamador decide (o finalize usa fail-open com
 * log, porque o cliente já validou a duração e o teto de 10 MB continua).
 */

function readBoxHeader(view: DataView, offset: number) {
  if (offset + 8 > view.byteLength) return null;
  const size32 = view.getUint32(offset, false);
  const type = String.fromCharCode(
    view.getUint8(offset + 4),
    view.getUint8(offset + 5),
    view.getUint8(offset + 6),
    view.getUint8(offset + 7),
  );
  let headerSize = 8;
  let size = size32;
  if (size32 === 1) {
    // largesize: tamanho de 64 bits.
    if (offset + 16 > view.byteLength) return null;
    const large = view.getBigUint64(offset + 8, false);
    if (large > BigInt(Number.MAX_SAFE_INTEGER)) return null;
    size = Number(large);
    headerSize = 16;
  } else if (size32 === 0) {
    // Caixa até o fim do arquivo.
    size = view.byteLength - offset;
  }
  if (size < headerSize || offset + size > view.byteLength) return null;
  return { type, size, headerSize, payloadOffset: offset + headerSize };
}

function parseMvhdDuration(view: DataView, payloadOffset: number, payloadSize: number) {
  // mvhd: version(1) + flags(3) + [v0: creation(4) modification(4) |
  // v1: creation(8) modification(8)] + timescale(4) + duration(4|8).
  if (payloadSize < 4) return null;
  const version = view.getUint8(payloadOffset);
  if (version === 0) {
    if (payloadSize < 20) return null;
    const timescale = view.getUint32(payloadOffset + 12, false);
    const duration = view.getUint32(payloadOffset + 16, false);
    if (!timescale) return null;
    return duration / timescale;
  }
  if (version === 1) {
    if (payloadSize < 32) return null;
    const timescale = view.getUint32(payloadOffset + 20, false);
    const duration = view.getBigUint64(payloadOffset + 24, false);
    if (!timescale) return null;
    return Number(duration) / timescale;
  }
  return null;
}

/** Duração em segundos do MP4, ou `null` se não der para ler. */
export function parseMp4DurationSeconds(buffer: ArrayBuffer): number | null {
  try {
    const view = new DataView(buffer);
    let offset = 0;
    while (offset < view.byteLength) {
      const box = readBoxHeader(view, offset);
      if (!box) return null;
      if (box.type === "moov") {
        let inner = box.payloadOffset;
        const moovEnd = box.payloadOffset + (box.size - box.headerSize);
        while (inner < moovEnd) {
          const child = readBoxHeader(view, inner);
          if (!child) return null;
          if (child.type === "mvhd") {
            const duration = parseMvhdDuration(
              view,
              child.payloadOffset,
              child.size - child.headerSize,
            );
            if (duration === null || !Number.isFinite(duration) || duration < 0) return null;
            return duration;
          }
          inner += child.size;
        }
        return null;
      }
      offset += box.size;
    }
    return null;
  } catch {
    return null;
  }
}
