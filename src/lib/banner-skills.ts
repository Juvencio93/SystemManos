/**
 * Sistema de skills do Manos Tech IA (gerador de banners).
 *
 * Cada skill é um pacote de conhecimento especializado que melhora a geração
 * dos prompts: fotografia, design, copy, eventos. O matching é 100%
 * determinístico (keyword match, sem custo de IA) sobre o pedido + segmento.
 *
 * Extensível: `loadBannerSkills` tenta ler a tabela `banner_skills` e mescla
 * com as embutidas (DB vence por nome). Se a tabela não existir, usa só as
 * embutidas — nenhum erro.
 */

export type BannerSkill = {
  /** identificador único, kebab-case */
  nome: string;
  /** descrição curta (1 linha) */
  descricao: string;
  /** gatilhos em pt-BR (case-insensitive, sem acento) */
  gatilhos: string[];
  /** expertise em markdown, injetada no system prompt */
  conteudo: string;
};

function norm(value: string): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}

export const BANNER_SKILLS_EMBUTIDAS: BannerSkill[] = [
  {
    nome: "fotografia-gastronomica",
    descricao: "Food styling e fotografia de pratos brasileiros",
    gatilhos: [
      "comida",
      "prato",
      "restaurante",
      "lanche",
      "pizza",
      "hamburguer",
      "bolo",
      "doce",
      "salgado",
      "padaria",
      "pao",
      "marmita",
      "feijoada",
      "churrasco",
      "petisco",
      "porcao",
      "jantar",
      "almoco",
      "cafe",
      "sorvete",
      "acai",
      "polenta",
      "galinha",
      "frango",
      "peixe",
      "massa",
      "lasanha",
      "esfiha",
      "pastel",
      "coxinha",
      "brigadeiro",
      "torta",
      "pudim",
    ],
    conteudo: `FOTOGRAFIA GASTRONÔMICA:
- Luz natural lateral ou backlight suave valoriza textura; evite flash direto chapado.
- Ângulo 45° é o mais apetitoso para pratos; top-down funciona para mesas postas e combos.
- Food styling: vapor sutil, molho escorrendo, queijo puxando, ervas frescas como guarnição.
- Pratos brasileiros pedem cor e abundância aparente: feijoada em cumbuca de barro, coxinha dourada e crocante, polenta cremosa com frango desfiado suculento.
- Fundo desfocado (bokeh) com elementos do ambiente; nunca competir com o prato.
- Cores quentes (amarelos, laranjas, vermelhos) estimulam apetite; evite tons azulados na comida.`,
  },
  {
    nome: "design-banner",
    descricao: "Composição, hierarquia visual, tipografia e CTA para banners",
    gatilhos: [
      "banner",
      "arte",
      "divulgacao",
      "anuncio",
      "cartaz",
      "layout",
      "composicao",
      "design",
      "criativo",
      "peca",
    ],
    conteudo: `DESIGN DE BANNER (16:9, 1920x1080, Portal Cativo):
- Hierarquia em 3 blocos no máximo: título/chamada, oferta ou informação principal, CTA.
- Regra dos terços para posicionar o ponto focal; área de respiro generosa ao redor do texto.
- Tipografia: uma família, no máximo dois pesos; título grande e legível à distância, nunca texto pequeno.
- CTA claro e único ("Peça agora", "Garanta o seu", "Confira") — sem dois CTAs concorrentes.
- Contraste forte entre texto e fundo; teste mental de leitura em 3 segundos.
- Logo discreto (até 12% da peça), com respiro; nunca deformar ou recriar a marca.
- Paleta coerente com a identidade; sem ela, tons neutros + uma cor de destaque.`,
  },
  {
    nome: "copy-marketing",
    descricao: "Copy persuasiva em pt-BR: gatilhos, chamadas e ofertas",
    gatilhos: [
      "promocao",
      "oferta",
      "desconto",
      "gratis",
      "gratuito",
      "cortesia",
      "preco",
      "valor",
      "cupom",
      "combo",
      "sorteio",
      "brinde",
      "condicao",
      "por conta da casa",
      "imperdivel",
    ],
    conteudo: `COPY DE MARKETING (pt-BR):
- Clareza acima de esperteza: a oferta precisa ser entendida em 3 segundos.
- Gatilhos que funcionam: escassez honesta ("só hoje", "vagas limitadas"), prova ("o queridinho da casa"), gratuidade ("por conta da casa", "grátis").
- Preço sempre em R$ com duas casas ("R$ 8,00"); nunca invente condição ("a partir de") que o cliente não disse.
- "Por conta da casa" é cortesia total: banner diz que é grátis/por conta da casa, valor zero.
- Evite superlativos vazios ("o melhor", "imperdível") sem prova; prefira fatos ("receita da vovó", "forno a lenha").
- Chamada para ação direta e no imperativo: "Peça o seu", "Garanta já", "Venha conferir".`,
  },
  {
    nome: "fotografia-produto",
    descricao: "Produto em destaque: fundo, iluminação e apresentação",
    gatilhos: [
      "produto",
      "loja",
      "roupa",
      "camisa",
      "calcado",
      "tenis",
      "joia",
      "anel",
      "relogio",
      "perfume",
      "cosmetico",
      "eletronico",
      "celular",
      "moveis",
      "decoracao",
      "presente",
      "kit",
      "colecao",
      "lancamento",
    ],
    conteudo: `FOTOGRAFIA DE PRODUTO:
- Fundo neutro ou desfocado; o produto é o herói absoluto da cena.
- Iluminação de estúdio suave com uma luz principal e preenchimento; sombras suaves dão volume.
- Ângulo que mostre o diferencial: textura de tecido, brilho de joia, detalhe do acabamento.
- Joias e relógios: macro controlado, reflexos gerenciados, fundo escuro elegante realça o brilho.
- Roupas: cabide fantasma ou modelo parcial sem rosto; tecido sem amassados, caimento natural.
- Nunca misturar produtos que não foram pedidos; um banner, um protagonista (ou o kit anunciado).
- Cores fiéis ao produto real; não saturar a ponto de enganar.`,
  },
  {
    nome: "eventos-festas",
    descricao: "Cobertura visual de eventos: música ao vivo, ambiente e energia",
    gatilhos: [
      "festa",
      "evento",
      "musica",
      "ao vivo",
      "show",
      "banda",
      "sertanejo",
      "samba",
      "pagode",
      "forro",
      "rock",
      "karaoke",
      "happy hour",
      "aniversario",
      "confraternizacao",
      "balada",
      "noite",
      "palco",
    ],
    conteudo: `EVENTOS E MÚSICA AO VIVO:
- Energia é o produto: luzes quentes, público animado (sem rostos identificáveis em destaque), palco com presença.
- "Ao vivo" precisa ser legível no texto do banner — é informação comercial, não decoração.
- Dia da semana por extenso e correto ("toda quinta-feira"); recorrência semanal deve estar explícita se o cliente confirmou.
- Se houver atração (banda, cantor), o nome dela tem hierarquia próxima à do evento.
- Evite clichê de balada genérica para bar familiar: adeque o clima ao perfil do local (boteco aconchegante ≠ casa noturna).
- Horário e entrada (gratuita ou valor) são fatos comerciais: só aparecem se confirmados.`,
  },
];

const MAX_SKILLS = 3;

/**
 * Matching determinístico: conta gatilhos presentes no pedido + segmento.
 * Retorna até 3 skills ordenadas por relevância. Custo zero de IA.
 */
export function detectarSkills(
  textoPedido: string,
  segmentoEmpresa?: string | null,
): BannerSkill[] {
  const texto = norm(`${textoPedido} ${segmentoEmpresa ?? ""}`);
  const palavras = new Set(texto.match(/[\p{L}\p{N}]{3,}/gu) ?? []);
  const scored = BANNER_SKILLS_EMBUTIDAS.map((skill) => {
    let pontos = 0;
    for (const gatilho of skill.gatilhos) {
      const g = norm(gatilho);
      if (palavras.has(g)) pontos += 2;
      else if (texto.includes(g)) pontos += 1;
    }
    return { skill, pontos };
  })
    .filter((s) => s.pontos > 0)
    .sort((a, b) => b.pontos - a.pontos)
    .slice(0, MAX_SKILLS);
  return scored.map((s) => s.skill);
}

export type BannerSkillRow = {
  nome: string;
  descricao: string;
  gatilhos: string[];
  conteudo: string;
  ativa?: boolean | null;
};

/**
 * Loader extensível: tenta mesclar skills do banco (tabela `banner_skills`,
 * quando existir) com as embutidas. DB vence por nome; skills desativadas
 * (ativa=false) são excluídas. Se a tabela não existir, retorna só as
 * embutidas — nunca lança erro.
 */
export async function loadBannerSkills(supabaseAdmin: {
  from: (tabela: string) => any;
}): Promise<BannerSkill[]> {
  const embutidas = new Map(BANNER_SKILLS_EMBUTIDAS.map((s) => [s.nome, s]));
  try {
    const { data, error } = await supabaseAdmin
      .from("banner_skills")
      .select("nome, descricao, gatilhos, conteudo, ativa");
    if (error || !Array.isArray(data)) return [...embutidas.values()];
    for (const row of data as BannerSkillRow[]) {
      if (!row?.nome || !row?.conteudo) continue;
      if (row.ativa === false) {
        embutidas.delete(norm(row.nome));
        continue;
      }
      embutidas.set(norm(row.nome), {
        nome: String(row.nome),
        descricao: String(row.descricao ?? ""),
        gatilhos: Array.isArray(row.gatilhos) ? row.gatilhos.map(String) : [],
        conteudo: String(row.conteudo),
      });
    }
  } catch {
    // tabela ainda não existe — segue só com as embutidas
  }
  return [...embutidas.values()];
}

/**
 * Matching sobre um conjunto customizado (útil quando o loader do DB
 * retornar skills extras). Mesma regra do detectarSkills.
 */
export function detectarSkillsEm(
  skills: BannerSkill[],
  textoPedido: string,
  segmentoEmpresa?: string | null,
): BannerSkill[] {
  const texto = norm(`${textoPedido} ${segmentoEmpresa ?? ""}`);
  const palavras = new Set(texto.match(/[\p{L}\p{N}]{3,}/gu) ?? []);
  return skills
    .map((skill) => {
      let pontos = 0;
      for (const gatilho of skill.gatilhos) {
        const g = norm(gatilho);
        if (palavras.has(g)) pontos += 2;
        else if (texto.includes(g)) pontos += 1;
      }
      return { skill, pontos };
    })
    .filter((s) => s.pontos > 0)
    .sort((a, b) => b.pontos - a.pontos)
    .slice(0, MAX_SKILLS)
    .map((s) => s.skill);
}

/** Formata as skills para injeção no system prompt. */
export function formatarSkillsParaPrompt(skills: BannerSkill[]): string {
  if (!skills.length) return "";
  return (
    "CONHECIMENTO ESPECIALIZADO (aplique ao criar os prompts):\n" +
    skills.map((s) => `\n## ${s.nome} — ${s.descricao}\n${s.conteudo}`).join("\n")
  );
}
