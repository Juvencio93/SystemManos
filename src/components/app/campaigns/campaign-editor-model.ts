import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import type { PortalAppearance } from "@/lib/campaign-appearance";
import {
  MAX_SPONSOR_BANNER_BYTES,
  MAX_SPONSOR_LOGO_BYTES,
  type SponsorDisplayType,
} from "@/lib/campaign-sponsors";

export const campaignSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome da campanha").max(120),
  description: z.string().trim().max(600).optional(),
  target: z.string().regex(/^(company|branch|event):[0-9a-f-]{36}$/, "Selecione o local"),
  redirect_url: z.string().trim().url("URL inválida").optional().or(z.literal("")),
});

export const MAX_BANNER_FILE_BYTES = 15 * 1024 * 1024;
export const MAX_OTHER_FILE_BYTES = 5 * 1024 * 1024;
const BANNER_MAX_WIDTH = 1600;
const BANNER_MAX_HEIGHT = 900;
const BANNER_WEBP_QUALITY = 0.8;

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

async function optimizeBanner(file: File) {
  const image = await decodeImage(file);
  const sourceWidth = image.width;
  const sourceHeight = image.height;
  const scale = Math.min(1, BANNER_MAX_WIDTH / sourceWidth, BANNER_MAX_HEIGHT / sourceHeight);
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Não foi possível otimizar o banner neste navegador.");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, width, height);
  if ("close" in image && typeof image.close === "function") image.close();
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error("Falha ao converter o banner."))),
      "image/webp",
      BANNER_WEBP_QUALITY,
    ),
  );
  const baseName = file.name.replace(/\.[^.]+$/, "") || "banner";
  return new File([blob], `${baseName}.webp`, { type: "image/webp", lastModified: Date.now() });
}

async function uploadImage(path: string, file: File) {
  const { error } = await supabase.storage.from("campaign-assets").upload(path, file, {
    cacheControl: "31536000",
    upsert: true,
    contentType: file.type,
  });
  if (error) throw error;
}

export async function uploadCampaignAsset(companyId: string, kind: "logo" | "banner", file: File) {
  if (!file.type.startsWith("image/")) throw new Error(`${file.name}: envie apenas imagens.`);
  const limit = kind === "banner" ? MAX_BANNER_FILE_BYTES : MAX_OTHER_FILE_BYTES;
  const limitLabel = kind === "banner" ? "15 MB" : "5 MB";
  if (file.size > limit) {
    throw new Error(
      `A imagem possui ${(file.size / (1024 * 1024)).toFixed(2)} MB. O limite é de ${limitLabel} por imagem.`,
    );
  }

  const uploadFile = kind === "banner" ? await optimizeBanner(file) : file;
  const ext = uploadFile.name.split(".").pop()?.toLowerCase() ?? "png";
  const path = `${companyId}/${kind}/${crypto.randomUUID()}.${ext}`;
  try {
    await uploadImage(path, uploadFile);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("maximum allowed size") || message.includes("413")) {
      throw new Error(
        `O servidor recusou o arquivo ${file.name} por exceder o limite real do Storage.`,
      );
    }
    throw new Error(`Erro no armazenamento (${file.name}): ${message}`);
  }
  return path;
}

export async function uploadSponsorAsset(
  companyId: string,
  kind: "sponsor-logo" | "sponsor-banner",
  file: File,
) {
  if (!file.type.startsWith("image/")) throw new Error(`${file.name}: envie apenas imagens.`);
  const limit = kind === "sponsor-banner" ? MAX_SPONSOR_BANNER_BYTES : MAX_SPONSOR_LOGO_BYTES;
  if (file.size > limit) {
    throw new Error(
      `A imagem possui ${(file.size / (1024 * 1024)).toFixed(2)} MB. O limite é de ${(limit / (1024 * 1024)).toFixed(0)} MB.`,
    );
  }
  const uploadFile = kind === "sponsor-banner" ? await optimizeBanner(file) : file;
  const ext = uploadFile.name.split(".").pop()?.toLowerCase() ?? "png";
  const path = `${companyId}/${kind}/${crypto.randomUUID()}.${ext}`;
  try {
    await uploadImage(path, uploadFile);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Erro no armazenamento (${file.name}): ${message}`);
  }
  return path;
}

export interface SponsorDraft {
  key: string;
  persistedId: string | null;
  name: string;
  displayType: SponsorDisplayType;
  logoPath: string | null;
  logoUrl: string | null;
  bannerPath: string | null;
  bannerUrl: string | null;
  linkUrl: string;
  active: boolean;
}

export interface Campaign {
  id: string;
  name: string;
  description: string | null;
  status: "ativa" | "encerrada" | "rascunho";
  started_at: string | null;
  ended_at: string | null;
  branch_id: string | null;
  event_id: string | null;
  company_id: string;
  logo_url: string | null;
  banner_urls: string[] | null;
  redirect_url: string | null;
  primary_color: string | null;
  accent_color: string | null;
  visual_style: string | null;
  logo_position: string | null;
  button_text: string | null;
  autoplay_enabled: boolean | null;
  show_arrows: boolean | null;
  show_indicators: boolean | null;
  show_progress_bar: boolean | null;
  quick_info_1: string | null;
  quick_info_2: string | null;
  quick_info_3: string | null;
}

export interface CampaignFormState {
  name: string;
  description: string;
  target: string;
  redirect_url: string;
  appearance: PortalAppearance;
}

export interface UploadProgress {
  status: "idle" | "uploading" | "error";
  message?: string;
  pendingCount: number;
  totalCount: number;
}

export interface EditingCampaignState {
  id: string;
  companyId: string;
  logoUrl: string | null;
  bannerUrls: string[];
}
