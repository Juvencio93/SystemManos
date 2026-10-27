-- Modo descrever do gerador de banners (substitui o chat).
--
-- Cota: 2 gerações de imagem por empresa por dia. A contagem usa a
-- tabela image_generations (uma linha por geração bem-sucedida, sem a
-- imagem em si — a imagem volta em base64 e o botão Salvar baixa
-- direto no aparelho). A tabela já existia nos tipos sem código usando;
-- o IF NOT EXISTS cobre os dois casos (existe ou não).
--
-- Anexos: só o link vai para o banco (nunca bytes de imagem em tabela).
-- O upload em si é feito pelo servidor com a service key no bucket
-- campaign-assets; esta tabela guarda o caminho para reuso e limpeza.
-- Teto: 10 fotos guardadas por empresa; além disso, o servidor apaga
-- as mais antigas do banco e do Storage a cada novo anexo.

CREATE TABLE IF NOT EXISTS public.image_generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches (id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  prompt text NOT NULL,
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS image_generations_company_created_idx
  ON public.image_generations (company_id, created_at DESC);

ALTER TABLE public.image_generations ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.banner_describe_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches (id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  storage_bucket text NOT NULL DEFAULT 'campaign-assets',
  storage_path text NOT NULL,
  public_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS banner_describe_attachments_company_created_idx
  ON public.banner_describe_attachments (company_id, created_at DESC);

-- Sem policies permissivas de propósito: só o servidor (service key,
-- que ignora RLS) lê e escreve aqui. O navegador nunca consulta estas
-- tabelas diretamente.
ALTER TABLE public.banner_describe_attachments ENABLE ROW LEVEL SECURITY;

-- Débito atômico da cota, espelhando increment_ai_question_usage_safe:
-- só insere quando o dia (America/Sao_Paulo) ainda tem menos de 2
-- gerações para a empresa. O servidor chama após o sucesso; se a RPC
-- recusar por corrida, a imagem já gerada ainda é entregue e o caso
-- vira alerta ao ADM (não tira a imagem do usuário).
CREATE OR REPLACE FUNCTION public.record_banner_image_generation(
  _user_id uuid,
  _company_id uuid,
  _branch_id uuid DEFAULT NULL,
  _prompt text DEFAULT ''
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role public.app_role;
  v_branch_id uuid;
  v_today_start timestamptz;
  v_count integer;
BEGIN
  SELECT role, branch_id INTO v_role, v_branch_id
  FROM public.user_roles
  WHERE user_id = _user_id AND company_id = _company_id;

  IF NOT FOUND THEN
    RETURN json_build_object('allowed', false, 'error', 'Usuário sem permissões.');
  END IF;

  IF v_role NOT IN ('matriz', 'filial') THEN
    RETURN json_build_object('allowed', false, 'error', 'Papel não suportado.');
  END IF;

  IF v_role = 'filial' AND v_branch_id IS DISTINCT FROM _branch_id THEN
    RETURN json_build_object('allowed', false, 'error', 'Contexto de unidade inválido.');
  END IF;

  v_today_start := date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo')
    AT TIME ZONE 'America/Sao_Paulo';

  SELECT count(*) INTO v_count
  FROM public.image_generations
  WHERE company_id = _company_id
    AND created_at >= v_today_start;

  IF v_count >= 2 THEN
    RETURN json_build_object('allowed', false, 'error', 'Cota diária atingida.');
  END IF;

  INSERT INTO public.image_generations (company_id, branch_id, user_id, prompt, image_url)
  VALUES (_company_id, _branch_id, _user_id, _prompt, NULL);

  RETURN json_build_object('allowed', true, 'error', null);
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_banner_image_generation(uuid, uuid, uuid, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_banner_image_generation(uuid, uuid, uuid, text)
  TO service_role;
