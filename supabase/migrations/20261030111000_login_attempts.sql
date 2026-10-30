-- Rate limiting de login (2026-10-30, item 2 da auditoria de login).
-- Registra cada tentativa de acesso (sucesso/falha) para bloquear força
-- bruta: 5 falhas em 15 min por e-mail+IP, ou 20 falhas em 15 min por IP
-- (qualquer e-mail). O sucesso zera as falhas do par e-mail+IP.
CREATE TABLE IF NOT EXISTS public.login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  ip text NOT NULL DEFAULT '',
  success boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS login_attempts_email_ip_created_idx
  ON public.login_attempts (lower(email), ip, created_at DESC)
  WHERE success = false;
CREATE INDEX IF NOT EXISTS login_attempts_ip_created_idx
  ON public.login_attempts (ip, created_at DESC)
  WHERE success = false;

-- Sem políticas públicas: o acesso é só via service_role (server
-- functions do painel), que ignora o RLS — mesmo padrão de
-- password_reset_requests.
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;
