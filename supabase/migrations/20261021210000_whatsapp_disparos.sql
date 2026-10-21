-- Disparos de WhatsApp via Evolution API (matriz/filial) — 2026-10-21.
-- Desenho do produto (regras do Gabriel):
--  * Enviar SOMENTE para quem autorizou no check-in do portal
--    (visitors.whatsapp_opt_in = true, sem revogação posterior).
--  * Teto de 100 envios/dia por número, em lotes de 10 a cada ~45-75 min,
--    com pausas aleatórias entre mensagens (padrão humano, anti-bloqueio).
--  * Número novo "aquece": 30/dia na 1ª semana, 50/dia na 2ª, 100 depois.
--  * Fila persistente por campanha: quem já recebeu nunca recebe de novo na
--    mesma campanha; o que faltar continua no dia seguinte até esgotar.
--  * Quem responder "SAIR" tem o opt-in revogado e sai de todas as filas.
-- O envio em si roda num worker externo (scripts/whatsapp-worker.mjs) que
-- consome a fila respeitando teto/lotes; o painel só gerencia e acompanha.

CREATE TABLE IF NOT EXISTS public.whatsapp_instancias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches (id) ON DELETE CASCADE,
  instance_name text NOT NULL UNIQUE,
  numero text,
  status text NOT NULL DEFAULT 'desconectada'
    CHECK (status IN ('desconectada', 'conectando', 'conectada')),
  conectada_em timestamptz,
  aquecimento_inicio date,
  ultimo_lote_em timestamptz,
  proximo_lote_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Uma instância por empresa (matriz) e uma por filial.
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_instancias_matriz_unica
  ON public.whatsapp_instancias (company_id)
  WHERE branch_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_instancias_filial_unica
  ON public.whatsapp_instancias (company_id, branch_id)
  WHERE branch_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.whatsapp_campanhas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches (id) ON DELETE SET NULL,
  instancia_id uuid NOT NULL REFERENCES public.whatsapp_instancias (id) ON DELETE CASCADE,
  titulo text NOT NULL,
  mensagem text NOT NULL,
  status text NOT NULL DEFAULT 'enviando'
    CHECK (status IN ('enviando', 'pausada', 'concluida', 'cancelada')),
  total integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  concluida_em timestamptz
);

CREATE INDEX IF NOT EXISTS whatsapp_campanhas_empresa_idx
  ON public.whatsapp_campanhas (company_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.whatsapp_fila (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campanha_id uuid NOT NULL REFERENCES public.whatsapp_campanhas (id) ON DELETE CASCADE,
  instancia_id uuid NOT NULL REFERENCES public.whatsapp_instancias (id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  visitor_id uuid REFERENCES public.visitors (id) ON DELETE SET NULL,
  telefone text NOT NULL,
  nome text,
  status text NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'enviado', 'erro', 'sem_whatsapp', 'optout')),
  tentativas integer NOT NULL DEFAULT 0,
  enviado_em timestamptz,
  erro text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Nunca duas vezes para o mesmo número dentro da mesma campanha.
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_fila_campanha_fone_unico
  ON public.whatsapp_fila (campanha_id, telefone);
CREATE INDEX IF NOT EXISTS whatsapp_fila_pendentes_idx
  ON public.whatsapp_fila (instancia_id, status, created_at);
CREATE INDEX IF NOT EXISTS whatsapp_fila_campanha_idx
  ON public.whatsapp_fila (campanha_id, status);

-- Sem políticas públicas: acesso só via service_role (funções do servidor
-- do painel e o worker de disparo), que ignora o RLS.
ALTER TABLE public.whatsapp_instancias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_campanhas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_fila ENABLE ROW LEVEL SECURITY;
