/**
 * Otimização de imagens no navegador (Frente 5 da correção de storage).
 *
 * O padrão é o mesmo do antigo `optimizeBanner`: decodifica, redimensiona
 * para um teto e converte para WebP. A imagem que chega ao Storage é a
 * otimizada — o original (PNG de vários MB) nunca é enviado. Se a
 * otimização falhar por qualquer motivo, o chamador envia o original
 * (fail-open, como já fazia o `optimizeBanner`): uma logo grande é
 * melhor que nenhum upload.
 *
 * Tetos (Frente 5): banner 1600×900, logo 1200×1200, qualidade WebP 0.8.
 */

const BANNER_MAX_WIDTH = 1600;
const BANNER_MAX_HEIGHT = 900;
const BANNER_WEBP_QUALITY = 0.8;
const LOGO_MAX_WIDTH = 1200;
const LOGO_MAX_HEIGHT = 1200;
const LOGO_WEBP_QUALITY = 0.8;

async function decodeImage(file: File) {
  if (typeof createImageBitmap === "function") return createImageBitmap(file);
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function optimizeImageToWebp(
  file: File,
  maxWidth: number,
  maxHeight: number,
  quality: number,
  fallbackName: string,
) {
  const image = await decodeImage(file);
  const sourceWidth = image.width;
  const sourceHeight = image.height;
  const scale = Math.min(1, maxWidth / sourceWidth, maxHeight / sourceHeight);
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Não foi possível otimizar a imagem neste navegador.");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, width, height);
  if ("close" in image && typeof image.close === "function") image.close();
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error("Falha ao converter a imagem."))),
      "image/webp",
      quality,
    ),
  );
  const baseName = file.name.replace(/\.[^.]+$/, "") || fallbackName;
  return new File([blob], `${baseName}.webp`, { type: "image/webp", lastModified: Date.now() });
}

/** Banner de campanha / patrocinador: WebP, teto 1600×900. */
export async function optimizeBanner(file: File) {
  return optimizeImageToWebp(file, BANNER_MAX_WIDTH, BANNER_MAX_HEIGHT, BANNER_WEBP_QUALITY, "banner");
}

/** Logo (campanha, patrocinador, empresa, filial): WebP, teto 1200×1200. */
export async function optimizeLogo(file: File) {
  return optimizeImageToWebp(file, LOGO_MAX_WIDTH, LOGO_MAX_HEIGHT, LOGO_WEBP_QUALITY, "logo");
}
