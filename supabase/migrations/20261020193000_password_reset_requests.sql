-- Redefinição de senha com aprovação do ADM (2026-10-20).
-- O "Esqueci minha senha" NÃO dispara mais e-mail automático do Supabase:
-- grava uma solicitação pendente aqui; o ADM aprova no painel ou pelo
-- Hermes (Telegram) e só então o link de redefinição é gerado (vale 1h).
CREATE TABLE IF NOT EXISTS public.password_reset_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  user_id uuid,
  user_label text,
  phone text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'denied', 'expired')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  decided_at timestamptz,
  decided_via text CHECK (decided_via IN ('painel', 'telegram')),
  decided_by text,
  link_generated_at timestamptz,
  notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Uma pendente por e-mail (pedir de novo atualiza a mesma solicitação).
CREATE UNIQUE INDEX IF NOT EXISTS password_reset_requests_one_pending_per_email
  ON public.password_reset_requests (lower(email))
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS password_reset_requests_status_idx
  ON public.password_reset_requests (status, requested_at DESC);

-- Sem políticas públicas: o acesso é só via service_role (funções do
-- servidor do painel e o Hermes), que ignora o RLS.
ALTER TABLE public.password_reset_requests ENABLE ROW LEVEL SECURITY;
