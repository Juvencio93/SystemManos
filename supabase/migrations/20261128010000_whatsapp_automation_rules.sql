-- PR #233 — Item 2 (parte 2): réguas automáticas de WhatsApp.
--
-- Duas tabelas novas:
--   whatsapp_automation_rules — uma regra de cada tipo por empresa (ou por
--     filial): welcome_coupon (cupom de boas-vindas), post_visit_nps (pesquisa
--     1–5) e winback_inactive (resgate de inativos).
--   whatsapp_automation_logs — um agendamento por gatilho: quem, qual regra,
--     quando enviar e o que aconteceu (inclui a resposta 1–5 do NPS).
--
-- Transporte agnóstico (Evolution + Meta Cloud API): as réguas já nascem com
-- meta_template_name/lang porque fora da janela de 24h a Meta exige template
-- aprovado; dentro da janela, texto livre. O envio Meta é ponto de extensão
-- (a perna Meta, PR #170, ainda não está no main) — hoje só Evolution envia.
--
-- RLS: mesmo padrão das tabelas de disparos — ENABLE ROW LEVEL SECURITY sem
-- policies (nega tudo exceto service_role; acesso só via server functions e
-- worker). Não há policies baseadas em company_id/branch_id para copiar.
--
-- Diferenças do desenho original (verificadas no código real):
--   - whatsapp_automation_logs tem instancia_id: o teto diário é por número,
--     e o worker conta os envios do dia por instância (fila + automações).
--   - winback: delay_minutes é o tempo de inatividade em minutos (ex.: 43200
--     = 30 dias); o envio é agendado para a hora em que o inativo é achado.
--   - min_visits usa visitors.connections_count (incrementado no check-in).

-- 1. Regras de automação.
CREATE TABLE IF NOT EXISTS public.whatsapp_automation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  branch_id uuid NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  rule_type text NOT NULL CHECK (rule_type IN ('welcome_coupon', 'post_visit_nps', 'winback_inactive')),
  enabled boolean NOT NULL DEFAULT false,
  delay_minutes integer NOT NULL DEFAULT 2 CHECK (delay_minutes >= 0),
  message_template text NOT NULL,
  meta_template_name text NULL,
  meta_template_lang text NOT NULL DEFAULT 'pt_BR',
  google_review_url text NULL,
  min_visits integer NOT NULL DEFAULT 1 CHECK (min_visits >= 1),
  cooldown_days integer NOT NULL DEFAULT 30 CHECK (cooldown_days >= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON COLUMN public.whatsapp_automation_rules.delay_minutes IS 'welcome/NPS: minutos após a conexão até enviar. winback: minutos de inatividade até resgatar.';
COMMENT ON COLUMN public.whatsapp_automation_rules.meta_template_name IS 'Template aprovado da Meta (obrigatório fora da janela de 24h); vazio = texto livre dentro da janela.';
COMMENT ON COLUMN public.whatsapp_automation_rules.google_review_url IS 'Link do Google Meu Negócio, enviado quando a nota do NPS é 4 ou 5.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_wa_rules_scope_type
  ON public.whatsapp_automation_rules
  (company_id, COALESCE(branch_id, '00000000-0000-0000-0000-000000000000'::uuid), rule_type);

ALTER TABLE public.whatsapp_automation_rules ENABLE ROW LEVEL SECURITY;

-- 2. Agendamentos (logs) das réguas.
CREATE TABLE IF NOT EXISTS public.whatsapp_automation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  branch_id uuid NULL REFERENCES public.branches(id) ON DELETE SET NULL,
  visitor_id uuid NOT NULL REFERENCES public.visitors(id) ON DELETE CASCADE,
  instancia_id uuid NULL REFERENCES public.whatsapp_instancias(id) ON DELETE SET NULL,
  phone_e164 text NOT NULL,
  rule_type text NOT NULL CHECK (rule_type IN ('welcome_coupon', 'post_visit_nps', 'winback_inactive')),
  trigger_ref text NOT NULL,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'processing', 'sent', 'awaiting_nps_reply', 'completed', 'skipped_optout', 'failed')),
  nps_score smallint NULL CHECK (nps_score BETWEEN 1 AND 5),
  scheduled_for timestamptz NOT NULL,
  sent_at timestamptz NULL,
  replied_at timestamptz NULL,
  error_message text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON COLUMN public.whatsapp_automation_logs.trigger_ref IS 'Origem do agendamento: id do grant (conexão) ou winback:YYYY-MM.';
COMMENT ON COLUMN public.whatsapp_automation_logs.instancia_id IS 'Número que enviou (para o teto diário por instância).';

CREATE UNIQUE INDEX IF NOT EXISTS idx_wa_logs_idempotency
  ON public.whatsapp_automation_logs (company_id, visitor_id, rule_type, trigger_ref);

CREATE INDEX IF NOT EXISTS idx_wa_logs_due
  ON public.whatsapp_automation_logs (status, scheduled_for)
  WHERE status = 'scheduled';

CREATE INDEX IF NOT EXISTS idx_wa_logs_nps_lookup
  ON public.whatsapp_automation_logs (company_id, phone_e164, status, sent_at DESC)
  WHERE rule_type = 'post_visit_nps' AND status = 'awaiting_nps_reply';

ALTER TABLE public.whatsapp_automation_logs ENABLE ROW LEVEL SECURITY;
