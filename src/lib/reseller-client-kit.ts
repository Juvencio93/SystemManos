/**
 * Kit do cliente do revendedor — regras puras (sem servidor) do fluxo
 * "Nova Empresa Cliente" do /revendas.
 *
 * - O revendedor cadastra o cliente dele, informa o MAC da RB e baixa o kit
 *   completo na hora (desde que tenha 1 crédito; o débito é feito pela RPC
 *   `reseller_consume_credit_for_unit` dentro de `createCompanyWithAccess`).
 * - O kit tem 4 arquivos: o script .rsc (gerado pela rota assinada
 *   /api/internal/mikrotik-activation, kind=setup), login.html v4,
 *   alogin.html v4 e o LEIA-ME.txt com o passo a passo.
 * - O script .rsc NÃO é gerado aqui: ele vem do gerador oficial, que junta
 *   o MANOS-HOTSPOT-BASE.rsc universal + ativação RADIUS + heartbeat para a
 *   identidade MT-... da RB. As credenciais RADIUS são globais (env) — não
 *   existe segredo RADIUS por empresa no sistema.
 * - UniFi aparece como "Em breve" e desabilitado: o adapter UniFi ainda não
 *   existe no backend, então não dá para gerar kit dele.
 */
import { normalizeMac } from "./rb-inventory";

export const CLIENT_KIT_PLANS = ["Essencial", "Profissional"] as const;
export type ClientKitPlan = (typeof CLIENT_KIT_PLANS)[number];

export type ClientKitVendorId = "mikrotik" | "unifi";

export const CLIENT_KIT_VENDORS: {
  id: ClientKitVendorId;
  label: string;
  note: string;
  disabled: boolean;
}[] = [
  {
    id: "mikrotik",
    label: "MikroTik RouterOS",
    note: "Kit Plug & Play v4 disponível",
    disabled: false,
  },
  {
    id: "unifi",
    label: "Ubiquiti UniFi",
    note: "Em breve",
    disabled: true,
  },
];

/** Máscara do MAC enquanto o usuário digita: XX:XX:XX:XX:XX:XX. */
export function formatMacInput(value: string): string {
  const hex = value.replace(/[^0-9A-Fa-f]/g, "").toUpperCase().slice(0, 12);
  return hex.match(/.{1,2}/g)?.join(":") ?? "";
}

/** MAC válido: 6 pares hexadecimais, sem ser 00:00:00:00:00:00 nem FF:FF:FF:FF:FF:FF. */
export function isValidMac(value: string): boolean {
  const normalized = normalizeMac(value);
  if (!normalized) return false;
  if (normalized === "00:00:00:00:00:00") return false;
  if (normalized === "FF:FF:FF:FF:FF:FF") return false;
  return true;
}

export type KitFileName = {
  key: "script" | "login" | "alogin" | "readme";
  fileName: string;
  description: string;
};

/** Os 4 arquivos do kit completo. O nome do .rsc segue o gerador oficial: <identidade>-setup.rsc. */
export function kitDownloadFileNames(routerIdentity: string): KitFileName[] {
  return [
    {
      key: "script",
      fileName: `${routerIdentity}-setup.rsc`,
      description: "Script de instalação da RB (base + ativação + heartbeat)",
    },
    {
      key: "login",
      fileName: "login.html",
      description: "Página do portal Wi-Fi (v4)",
    },
    {
      key: "alogin",
      fileName: "alogin.html",
      description: "Página de pós-login (v4)",
    },
    {
      key: "readme",
      fileName: "LEIA-ME.txt",
      description: "Passo a passo da instalação",
    },
  ];
}

/** Monta o payload de `createCompanyWithAccess` a partir dos campos do modal. */
export function buildResellerClientCompanyInput(fields: {
  name: string;
  slug: string;
  document: string | null;
  city: string | null;
  state: string | null;
  plan: ClientKitPlan;
  monthlyPrice: number;
  accessEmail: string;
  accessPassword: string;
}) {
  return {
    name: fields.name.trim(),
    slug: fields.slug,
    document: fields.document,
    city: fields.city,
    state: fields.state,
    plan_name: fields.plan,
    monthly_price: fields.monthlyPrice,
    activation_limit: 1,
    subscription_status: "ativa" as const,
    access_email: fields.accessEmail.trim().toLowerCase(),
    access_password: fields.accessPassword,
  };
}

export function buildKitReadme(input: {
  companyName: string;
  slug: string;
  routerIdentity: string;
  mac: string;
  nickname: string | null;
}): string {
  const lines = [
    `Kit de instalação — ${input.companyName}`,
    `Portal: ${input.slug}`,
    `Equipamento: ${input.nickname ? `${input.nickname} — ` : ""}${input.routerIdentity} (MAC ${input.mac})`,
    ``,
    `O QUE VEM NESTE KIT`,
    `1. ${input.routerIdentity}-setup.rsc — script de instalação da RB (base + ativação + heartbeat).`,
    `2. login.html — página do portal Wi-Fi que o visitante vê ao se conectar.`,
    `3. alogin.html — página que aparece logo depois do login.`,
    ``,
    `COMO INSTALAR (3 passos)`,
    `1. Reset sem configuração padrão: na RB, faça o reset marcando "No Default Configuration".`,
    `2. Importar o .rsc: envie o arquivo ${input.routerIdentity}-setup.rsc para a RB e rode /import file-name=${input.routerIdentity}-setup.rsc`,
    `3. Subir login.html e alogin.html na pasta hotspot da RB (a mesma pasta usada pelo portal).`,
    ``,
    `Depois da instalação, a RB aparece no painel como aguardando homologação.`,
    `A rede dos visitantes (192.168.88.0/24) já nasce separada da rede do caixa (192.168.89.0/24).`,
    ``,
    `Dúvidas? Fale com a ManosTech pelo painel do seu revendedor.`,
  ];
  return lines.join("\n");
}
