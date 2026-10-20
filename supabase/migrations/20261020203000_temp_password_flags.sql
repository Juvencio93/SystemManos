-- Senha temporária na redefinição aprovada (2026-10-20): ao aprovar um
-- pedido, o sistema grava uma senha temporária (1h) no usuário e marca
-- estas flags; o painel bloqueia tudo até a troca definitiva.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS temp_password_until timestamptz;
