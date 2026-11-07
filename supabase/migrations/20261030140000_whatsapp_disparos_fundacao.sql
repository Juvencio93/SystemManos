-- Fundação do sistema de Disparos WhatsApp via Cloud API (Meta) — 2026-10-30.
-- Modelo: Tech Provider, sem BSP. Cliente paga a Meta direto; Manos Tech cobra o módulo.
-- Tabelas novas (nomes reais do schema: companies, branches, company_id, branch_id).

-- Conexões WhatsApp por empresa/filial (uma por empresa ou filial)
CREATE TABLE IF NOT EXISTS public.whatsapp_conexoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches (id) ON DELETE CASCADE,
  waba_id text,
  phone_number_id text,
  numero text,
  display_name text,
  modo text CHECK (modo IN ('coexistencia', 'api_puro')),
  status text NOT NULL DEFAULT 'desconectado'
    CHECK (status IN ('conectado', 'desconectado', 'erro')),
  token_criptografado text,
  quality_rating text CHECK (quality_rating IN ('high', 'medium', 'low')),
  messaging_tier text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Uma conexão por empresa (matriz) e uma por filial.
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_conexoes_matriz_unica
  ON public.whatsapp_conexoes (company_id)
  WHERE branch_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_conexoes_filial_unica
  ON public.whatsapp_conexoes (company_id, branch_id)
  WHERE branch_id IS NOT NULL;

-- Templates de mensagem (ciclo: rascunho → em_analise → aprovado/reprovado)
CREATE TABLE IF NOT EXISTS public.whatsapp_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  nome text NOT NULL,
  categoria text NOT NULL DEFAULT 'marketing',
  idioma text NOT NULL DEFAULT 'pt_BR',
  corpo text NOT NULL,
  header_tipo text CHECK (header_tipo IN ('texto', 'imagem')),
  header_conteudo text,
  botoes jsonb NOT NULL DEFAULT '[]',
  status text NOT NULL DEFAULT 'rascunho'
    CHECK (status IN ('rascunho', 'em_analise', 'aprovado', 'reprovado')),
  motivo_reprovacao text,
  meta_template_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS whatsapp_templates_empresa_idx
  ON public.whatsapp_templates (company_id, created_at DESC);

-- Supressão: quem pediu pra parar nunca recebe disparo (opt-out / LGPD)
CREATE TABLE IF NOT EXISTS public.whatsapp_supressao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  telefone text NOT NULL,
  motivo text CHECK (motivo IN ('stop', 'botao', 'erro_131050')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, telefone)
);

-- Medição mensal por empresa (base da cota e do consumo)
CREATE TABLE IF NOT EXISTS public.whatsapp_medicao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  ano_mes text NOT NULL,
  disparos_feitos integer NOT NULL DEFAULT 0,
  mensagens_enviadas integer NOT NULL DEFAULT 0,
  mensagens_entregues integer NOT NULL DEFAULT 0,
  custo_estimado numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, ano_mes)
);

-- Mídia temporária (upload otimizado; job diário limpa arquivos com +48h)
CREATE TABLE IF NOT EXISTS public.whatsapp_midia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  template_id uuid REFERENCES public.whatsapp_templates (id) ON DELETE SET NULL,
  caminho_temp text,
  meta_media_id text,
  tamanho_bytes bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS whatsapp_midia_limpeza_idx
  ON public.whatsapp_midia (created_at);

-- Planos do módulo de disparos
CREATE TABLE IF NOT EXISTS public.whatsapp_planos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  disparos_incluidos_mes integer NOT NULL,
  valor_mensal numeric(10,2) NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Plano padrão: "Essencial" — 4 disparos/mês — R$ 49,90
INSERT INTO public.whatsapp_planos (nome, disparos_incluidos_mes, valor_mensal)
SELECT 'Essencial', 4, 49.90
WHERE NOT EXISTS (SELECT 1 FROM public.whatsapp_planos WHERE nome = 'Essencial');

-- Colunas novas em companies: módulo de disparos + cota customizada
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS modulo_disparos_ativo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS plano_disparo_id uuid REFERENCES public.whatsapp_planos (id),
  ADD COLUMN IF NOT EXISTS cota_custom_disparos integer;

-- Sem políticas públicas: acesso só via service_role (funções do servidor),
-- que ignora o RLS.
ALTER TABLE public.whatsapp_conexoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_supressao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_medicao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_midia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_planos ENABLE ROW LEVEL SECURITY;
