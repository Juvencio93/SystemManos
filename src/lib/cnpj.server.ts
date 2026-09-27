import { formatCnpj, isValidCnpj, onlyDigits } from "./cnpj-utils";
import type { CnpjLookup } from "./cnpj-utils";
export type { CnpjLookup };

type BrasilApiCnpj = {
  cnpj?: string;
  razao_social?: string;
  nome_fantasia?: string;
  descricao_situacao_cadastral?: string;
  logradouro?: string;
  número?: string;
  complemento?: string;
  cep?: string;
  bairro?: string;
  município?: string;
  uf?: string;
  cnae_fiscal?: number;
  cnae_fiscal_descricao?: string;
  email?: string;
  ddd_telefone_1?: string;
  qsa?: Array<{ nome_socio?: string; qualificacao_socio?: string }>;
};

/** Consulta pontual na BrasilAPI (fonte de preenchimento, nunca banco principal). */
export async function fetchCnpj(rawCnpj: string): Promise<CnpjLookup> {
  const cnpj = onlyDigits(rawCnpj);
  if (!isValidCnpj(cnpj)) throw new Error("CNPJ inválido.");

  // BrasilAPI as fonte primaria; minhareceita.org (mesmo formato) como fallback
  const endpoints = [
    `https://brasilapi.com.br/api/cnpj/v1/${cnpj}`,
    `https://minhareceita.org/${cnpj}`,
  ];

  let data: BrasilApiCnpj | null = null;
  let lastStatus = 0;
  let lastBody = "";

  for (const url of endpoints) {
    for (let attempt = 0; attempt < 2 && !data; attempt++) {
      try {
        const response = await fetch(url, { headers: { accept: "application/json" } });
        if (response.status === 404) {
          throw new Error("CNPJ não encontrado na base da Receita.");
        }
        if (!response.ok) {
          lastStatus = response.status;
          lastBody = (await response.text()).slice(0, 300);
          console.error(`Consulta CNPJ falhou [${response.status}] ${url}: ${lastBody}`);
          if (response.status === 429 || response.status >= 500) {
            await new Promise((r) => setTimeout(r, 700));
            continue;
          }
          break;
        }
        data = (await response.json()) as BrasilApiCnpj;
      } catch (err) {
        if (err instanceof Error && err.message.startsWith("CNPJ não encontrado")) throw err;
        lastBody = err instanceof Error ? err.message : String(err);
        console.error(`Consulta CNPJ erro em ${url}: ${lastBody}`);
        await new Promise((r) => setTimeout(r, 500));
      }
    }
    if (data) break;
  }

  if (!data) {
    throw new Error(
      `Consulta de CNPJ indisponivel no momento (${lastStatus || "sem resposta"}). Tente novamente em instantes ou preencha os dados manualmente.`,
    );
  }

  const address = [data.logradouro, data.número, data.complemento].filter(Boolean).join(", ");

  return {
    document: formatCnpj(data.cnpj ?? cnpj),
    legal_name: data.razao_social ?? "",
    trade_name: data.nome_fantasia ?? "",
    registration_status: data.descricao_situacao_cadastral ?? "",
    address,
    zip_code: data.cep ? String(data.cep) : "",
    neighborhood: data.bairro ?? "",
    city: data.município ?? "",
    state: data.uf ?? "",
    cnae_code: data.cnae_fiscal ? String(data.cnae_fiscal) : "",
    cnae_description: data.cnae_fiscal_descricao ?? "",
    contact_email: data.email ?? "",
    contact_phone: data.ddd_telefone_1 ?? "",
    partners: (data.qsa ?? [])
      .map((p) => [p.nome_socio, p.qualificacao_socio].filter(Boolean).join(" — "))
      .filter(Boolean)
      .slice(0, 10),
  };
}
