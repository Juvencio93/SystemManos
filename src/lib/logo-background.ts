/**
 * Remoção automática de fundo da logo do portal.
 *
 * Lojistas enviam a logo "dentro de caixa" (JPG com fundo branco/chapado) e,
 * no portal — principalmente nos temas escuros — a caixa aparece. Esta função
 * detecta um fundo uniforme conectado às bordas e o torna transparente, direto
 * no navegador: sem custo de API, sem sair do aparelho do lojista.
 *
 * Segurança (para não estragar logo boa):
 * - Só age quando o fundo é UNIFORME (os 4 cantos concordam entre si);
 * - Só remove o que está CONECTADO à borda (flood fill) — branco DENTRO da
 *   arte da logo nunca é tocado;
 * - Se a imagem já tem transparência, devolve o original;
 * - Qualquer erro ou dúvida: devolve o arquivo original intacto.
 */

export type RemoveBackgroundResult = {
  /** Arquivo pronto para upload (PNG com transparência quando removeu). */
  file: File;
  /** true quando o fundo foi detectado e removido. */
  removed: boolean;
};

type RGB = [number, number, number];

/** Cantos precisam concordar entre si (diferença máxima por canal). */
const CORNER_TOLERANCE = 18;
/** Distância euclidiana de cor aceita como "fundo" no flood fill. */
const FILL_TOLERANCE = 42;
/** Amostra de cada canto (bloco NxN). */
const CORNER_SAMPLE = 6;

function channelDiff(a: RGB, b: RGB): number {
  return Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]));
}

function euclidean(a: RGB, b: RGB): number {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/** true se algum pixel já tem transparência real. */
export function hasTransparency(data: Uint8ClampedArray): boolean {
  for (let i = 3; i < data.length; i += 4) {
    if (data[i]! < 250) return true;
  }
  return false;
}

function sampleCorner(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  x0: number,
  y0: number,
): RGB | null {
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let y = y0; y < Math.min(y0 + CORNER_SAMPLE, height); y++) {
    for (let x = x0; x < Math.min(x0 + CORNER_SAMPLE, width); x++) {
      const i = (y * width + x) * 4;
      if (data[i + 3]! < 250) continue; // ignora pixel já transparente
      r += data[i]!;
      g += data[i + 1]!;
      b += data[i + 2]!;
      n++;
    }
  }
  if (n === 0) return null;
  return [r / n, g / n, b / n];
}

/**
 * Detecta a cor do fundo a partir dos 4 cantos. Retorna null quando os cantos
 * não concordam (fundo não uniforme — foto, gradiente) ou a imagem é pequena
 * demais para analisar.
 */
export function detectUniformBackground(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): RGB | null {
  if (width < 8 || height < 8) return null;
  const corners = [
    sampleCorner(data, width, height, 0, 0),
    sampleCorner(data, width, height, width - CORNER_SAMPLE, 0),
    sampleCorner(data, width, height, 0, height - CORNER_SAMPLE),
    sampleCorner(data, width, height, width - CORNER_SAMPLE, height - CORNER_SAMPLE),
  ];
  if (corners.some((c) => c === null)) return null;
  const cs = corners as RGB[];
  for (let i = 1; i < cs.length; i++) {
    if (channelDiff(cs[0]!, cs[i]!) > CORNER_TOLERANCE) return null;
  }
  return [
    (cs[0]![0] + cs[1]![0] + cs[2]![0] + cs[3]![0]) / 4,
    (cs[0]![1] + cs[1]![1] + cs[2]![1] + cs[3]![1]) / 4,
    (cs[0]![2] + cs[1]![2] + cs[2]![2] + cs[3]![2]) / 4,
  ];
}

/**
 * Torna transparentes os pixels parecidos com `bg` CONECTADOS à borda
 * (flood fill). Retorna quantos pixels foram removidos.
 */
export function floodFillTransparent(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  bg: RGB,
  tolerance: number = FILL_TOLERANCE,
): number {
  const visited = new Uint8Array(width * height);
  const stack = new Int32Array(width * height);
  let sp = 0;
  let removed = 0;

  const tryPush = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const p = y * width + x;
    if (visited[p]) return;
    visited[p] = 1;
    const i = p * 4;
    if (data[i + 3]! < 250) return; // já transparente: não atravessa
    const c: RGB = [data[i]!, data[i + 1]!, data[i + 2]!];
    if (euclidean(c, bg) > tolerance) return;
    stack[sp++] = p;
  };

  for (let x = 0; x < width; x++) {
    tryPush(x, 0);
    tryPush(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    tryPush(0, y);
    tryPush(width - 1, y);
  }

  while (sp > 0) {
    const p = stack[--sp]!;
    const i = p * 4;
    data[i + 3] = 0;
    removed++;
    const x = p % width;
    const y = (p - x) / width;
    tryPush(x + 1, y);
    tryPush(x - 1, y);
    tryPush(x, y + 1);
    tryPush(x, y - 1);
  }
  return removed;
}

async function loadBitmap(file: File): Promise<ImageBitmap> {
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(file);
  }
  // Fallback para navegadores antigos.
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "sync";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Não foi possível ler a imagem."));
      img.src = url;
    });
    return createImageBitmap(img);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Ponto de entrada: recebe o arquivo da logo e, quando detecta fundo chapado,
 * devolve um PNG com o fundo transparente. Nunca quebra o upload: em qualquer
 * dúvida ou erro, devolve o arquivo original.
 */
export async function removeLogoBackground(file: File): Promise<RemoveBackgroundResult> {
  const keepOriginal = (): RemoveBackgroundResult => ({ file, removed: false });
  try {
    const bitmap = await loadBitmap(file);
    try {
      const { width, height } = bitmap;
      if (width < 8 || height < 8) return keepOriginal();
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return keepOriginal();
      ctx.drawImage(bitmap, 0, 0);
      const imageData = ctx.getImageData(0, 0, width, height);
      if (hasTransparency(imageData.data)) return keepOriginal();
      const bg = detectUniformBackground(imageData.data, width, height);
      if (!bg) return keepOriginal();
      const removed = floodFillTransparent(imageData.data, width, height, bg);
      // Quase nada removido = não era uma "caixa" — mantém o original.
      if (removed < width * height * 0.005) return keepOriginal();
      ctx.putImageData(imageData, 0, 0);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png"),
      );
      if (!blob) return keepOriginal();
      const baseName = file.name.replace(/\.[^.]+$/, "") || "logo";
      return {
        file: new File([blob], `${baseName}.png`, { type: "image/png" }),
        removed: true,
      };
    } finally {
      bitmap.close();
    }
  } catch {
    return keepOriginal();
  }
}
