import { Json } from "@/integrations/supabase/types";

export type HotspotVendor =
  | "test"
  | "mikrotik"
  | "radius"
  | "mikrotik_hotspot"
  | "intelbras_zeus"
  | "intelbras_hotspot300_legacy";

export interface HotspotReleaseInput {
  mac: string;
  ip: string;
  username: string;
  password?: string;
  loginUrl?: string;
  config: Json;
}

export interface HotspotReleaseResult {
  success: boolean;
  message: string;
  redirectUrl?: string;
}

export abstract class HotspotAdapter {
  abstract release(input: HotspotReleaseInput): Promise<HotspotReleaseResult>;
}

export class TestAdapter extends HotspotAdapter {
  async release(_input: HotspotReleaseInput): Promise<HotspotReleaseResult> {
    return { success: true, message: "Acesso liberado (Modo Teste)" };
  }
}

class UnsupportedAdapter extends HotspotAdapter {
  constructor(private readonly vendor: HotspotVendor) {
    super();
  }

  async release(_input: HotspotReleaseInput): Promise<HotspotReleaseResult> {
    return {
      success: false,
      message: `A liberação real para ${this.vendor} ainda não foi homologada.`,
    };
  }
}

export function getAdapter(vendor: HotspotVendor): HotspotAdapter {
  switch (vendor) {
    case "mikrotik_hotspot":
    case "mikrotik":
    case "radius":
    case "intelbras_zeus":
    case "intelbras_hotspot300_legacy":
      return new UnsupportedAdapter(vendor);
    case "test":
      return new TestAdapter();
    default:
      return new UnsupportedAdapter(vendor);
  }
}
