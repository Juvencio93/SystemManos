-- Trilha de auditoria de ações administrativas (item 7 da auditoria de
-- segurança, 2026-11-12; frente 10 do plano P2).
-- Registra quem fez o quê, quando e em qual empresa: edição/criação/
-- exclusão de empresa, bloqueio/desbloqueio, reset de acesso, confirmação
-- de pagamento, aprovação/negação de reset de senha e acessos de revenda.
-- NÃO há tela de visualização nesta frente: a leitura é só server-side
-- (service_role), para uma futura tela de "logs do sistema" do ADM.
-- O detalhe (details) guarda SÓ dados não sensíveis — nunca senhas,
-- tokens ou segredos.
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  actor_email text,
  action text NOT NULL,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_audit_log_company_created_idx
  ON public.admin_audit_log (company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_log_user_created_idx
  ON public.admin_audit_log (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_log_action_created_idx
  ON public.admin_audit_log (action, created_at DESC);

-- Sem políticas públicas: o acesso é só via service_role (server
-- functions do painel), que ignora o RLS — mesmo padrão de
-- login_attempts e das tabelas de integração (deny-all p/ authenticated).
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
