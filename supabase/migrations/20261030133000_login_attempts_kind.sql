-- 2FA (item 4 da auditoria de login, 2026-10-30): a mesma tabela passa a
-- registrar também as tentativas de código TOTP (kind = 'mfa_verify'),
-- separadas das tentativas de senha (kind = 'login'), com limites próprios.
ALTER TABLE public.login_attempts
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'login';

CREATE INDEX IF NOT EXISTS login_attempts_kind_email_ip_created_idx
  ON public.login_attempts (kind, lower(email), ip, created_at DESC)
  WHERE success = false;
CREATE INDEX IF NOT EXISTS login_attempts_kind_ip_created_idx
  ON public.login_attempts (kind, ip, created_at DESC)
  WHERE success = false;
