-- ENUMS
CREATE TYPE public.app_role AS ENUM ('adm', 'matriz', 'filial');
CREATE TYPE public.company_status AS ENUM ('ativa', 'bloqueada', 'suspensa', 'cancelada');
CREATE TYPE public.campaign_status AS ENUM ('rascunho', 'ativa', 'encerrada');
CREATE TYPE public.event_status AS ENUM ('planejado', 'ativo', 'encerrado', 'cancelado');

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- COMPANIES
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  document TEXT,
  segment TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  city TEXT,
  state TEXT,
  plan_name TEXT NOT NULL DEFAULT 'Essencial',
  monthly_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  activation_limit INTEGER NOT NULL DEFAULT 1,
  status public.company_status NOT NULL DEFAULT 'ativa',
  blocked BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  legal_name text,
  trade_name text,
  registration_status text,
  zip_code text,
  neighborhood text,
  cnae_code text,
  cnae_description text,
  address text,
  due_day integer,
  subscription_status text NOT NULL DEFAULT 'ativa',
  logo_url text,
  access_email text,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.companies TO authenticated;
GRANT ALL ON public.companies TO service_role;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- BRANCHES
CREATE TABLE public.branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  portal_slug TEXT NOT NULL UNIQUE,
  address TEXT,
  city TEXT,
  state TEXT,
  daily_reset_time TIME NOT NULL DEFAULT '07:50',
  is_headquarters BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  document text,
  legal_name text,
  trade_name text,
  zip_code text,
  neighborhood text,
  registration_status text,
  logo_url text,
  access_email text,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.branches TO authenticated;
GRANT ALL ON public.branches TO service_role;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

-- EVENTS
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  portal_slug TEXT NOT NULL UNIQUE,
  location TEXT,
  starts_at DATE,
  ends_at DATE,
  daily_reset_time TIME NOT NULL DEFAULT '07:50',
  contracted_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  paid_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  cost_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  status public.event_status NOT NULL DEFAULT 'planejado',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO authenticated;
GRANT ALL ON public.events TO service_role;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- USER ROLES (never on profiles)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role, company_id, branch_id)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- CAMPAIGNS
CREATE TABLE public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status public.campaign_status NOT NULL DEFAULT 'rascunho',
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  logo_url text,
  banner_urls text[] NOT NULL DEFAULT '{}'::text[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT campaign_context_check CHECK (
    (branch_id IS NOT NULL AND event_id IS NULL) OR (branch_id IS NULL AND event_id IS NOT NULL)
  )
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaigns TO authenticated;
GRANT ALL ON public.campaigns TO service_role;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX campaigns_one_active_per_branch
  ON public.campaigns (branch_id) WHERE status = 'ativa' AND branch_id IS NOT NULL;
CREATE UNIQUE INDEX campaigns_one_active_per_event
  ON public.campaigns (event_id) WHERE status = 'ativa' AND event_id IS NOT NULL;

-- VISITORS (CRM)
CREATE TABLE public.visitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT,
  phone_e164 TEXT NOT NULL,
  country_code TEXT NOT NULL DEFAULT '+55',
  country TEXT,
  city TEXT,
  lgpd_consent BOOLEAN NOT NULL DEFAULT false,
  lgpd_consent_at TIMESTAMPTZ,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  connections_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, phone_e164)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.visitors TO authenticated;
GRANT ALL ON public.visitors TO service_role;
ALTER TABLE public.visitors ENABLE ROW LEVEL SECURITY;

-- CONNECTIONS
CREATE TABLE public.connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  visitor_id UUID NOT NULL REFERENCES public.visitors(id) ON DELETE CASCADE,
  device_type TEXT,
  user_agent TEXT,
  period_date DATE NOT NULL DEFAULT CURRENT_DATE,
  is_returning BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.connections TO authenticated;
GRANT ALL ON public.connections TO service_role;
ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;

CREATE INDEX connections_company_created_idx ON public.connections (company_id, created_at DESC);
CREATE INDEX connections_branch_period_idx ON public.connections (branch_id, period_date);
CREATE INDEX connections_campaign_idx ON public.connections (campaign_id);

-- COMPANY CHARGES
CREATE TABLE public.company_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  reference text NOT NULL DEFAULT 'Mensalidade',
  amount numeric NOT NULL DEFAULT 0,
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'pendente',
  paid_at timestamp with time zone,
  method text,
  external_id text,
  pix_payload text,
  receipt_code text NOT NULL DEFAULT concat('MT-', to_char(now(), 'YYYYMMDD'), '-', substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT company_charges_status_check CHECK (status IN ('pendente', 'pago', 'atrasado', 'cancelado'))
);
CREATE INDEX company_charges_company_due_idx ON public.company_charges (company_id, due_date DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_charges TO authenticated;
GRANT ALL ON public.company_charges TO service_role;
ALTER TABLE public.company_charges ENABLE ROW LEVEL SECURITY;

-- SECURITY DEFINER HELPERS
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_adm()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'adm')
$$;

CREATE OR REPLACE FUNCTION public.current_company_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT company_id FROM public.user_roles
  WHERE user_id = auth.uid() AND company_id IS NOT NULL
  ORDER BY role LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.current_branch_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT branch_id FROM public.user_roles
  WHERE user_id = auth.uid() AND role = 'filial' AND branch_id IS NOT NULL
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_matriz_of(_company_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'matriz' AND company_id = _company_id
  )
$$;

CREATE OR REPLACE FUNCTION public.is_branch_user_of(_branch_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'filial' AND branch_id = _branch_id
  )
$$;

-- Branding basico da empresa para usuarios filial (sem qualquer dado financeiro)
CREATE OR REPLACE FUNCTION public.my_company_basics()
RETURNS TABLE (id uuid, name text, blocked boolean, logo_url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id, c.name, c.blocked, c.logo_url
  FROM public.companies c
  WHERE c.id = public.current_company_id()
$$;

-- POLICIES: profiles
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_adm());
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_adm()) WITH CHECK (id = auth.uid() OR public.is_adm());
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- POLICIES: user_roles
CREATE POLICY "user_roles_select_own_or_adm" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_adm() OR public.is_matriz_of(company_id));

-- POLICIES: companies (filial nao le a tabela: contem plano e valores)
CREATE POLICY "companies_adm_all" ON public.companies FOR ALL TO authenticated
  USING (public.is_adm()) WITH CHECK (public.is_adm());
CREATE POLICY "companies_read_own" ON public.companies FOR SELECT TO authenticated
  USING (public.is_matriz_of(id));
CREATE POLICY "companies_matriz_update" ON public.companies FOR UPDATE TO authenticated
  USING (public.is_matriz_of(id)) WITH CHECK (public.is_matriz_of(id));

-- POLICIES: branches
CREATE POLICY "branches_adm_all" ON public.branches FOR ALL TO authenticated
  USING (public.is_adm()) WITH CHECK (public.is_adm());
CREATE POLICY "branches_matriz_all" ON public.branches FOR ALL TO authenticated
  USING (public.is_matriz_of(company_id)) WITH CHECK (public.is_matriz_of(company_id));
CREATE POLICY "branches_filial_read_own" ON public.branches FOR SELECT TO authenticated
  USING (public.is_branch_user_of(id));

-- POLICIES: events (sem acesso para filial: contem valores)
CREATE POLICY "events_adm_all" ON public.events FOR ALL TO authenticated
  USING (public.is_adm()) WITH CHECK (public.is_adm());
CREATE POLICY "events_matriz_all" ON public.events FOR ALL TO authenticated
  USING (public.is_matriz_of(company_id)) WITH CHECK (public.is_matriz_of(company_id));

-- POLICIES: campaigns
CREATE POLICY "campaigns_adm_all" ON public.campaigns FOR ALL TO authenticated
  USING (public.is_adm()) WITH CHECK (public.is_adm());
CREATE POLICY "campaigns_matriz_all" ON public.campaigns FOR ALL TO authenticated
  USING (public.is_matriz_of(company_id)) WITH CHECK (public.is_matriz_of(company_id));
CREATE POLICY "campaigns_filial_all" ON public.campaigns FOR ALL TO authenticated
  USING (branch_id IS NOT NULL AND public.is_branch_user_of(branch_id))
  WITH CHECK (branch_id IS NOT NULL AND public.is_branch_user_of(branch_id));

-- POLICIES: visitors
CREATE POLICY "visitors_adm_all" ON public.visitors FOR ALL TO authenticated
  USING (public.is_adm()) WITH CHECK (public.is_adm());
CREATE POLICY "visitors_matriz_all" ON public.visitors FOR ALL TO authenticated
  USING (public.is_matriz_of(company_id)) WITH CHECK (public.is_matriz_of(company_id));
CREATE POLICY "visitors_filial_read" ON public.visitors FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.connections c
    WHERE c.visitor_id = visitors.id AND c.branch_id = public.current_branch_id()
  ));

-- POLICIES: connections
CREATE POLICY "connections_adm_all" ON public.connections FOR ALL TO authenticated
  USING (public.is_adm()) WITH CHECK (public.is_adm());
CREATE POLICY "connections_matriz_all" ON public.connections FOR ALL TO authenticated
  USING (public.is_matriz_of(company_id)) WITH CHECK (public.is_matriz_of(company_id));
CREATE POLICY "connections_filial_read" ON public.connections FOR SELECT TO authenticated
  USING (branch_id IS NOT NULL AND public.is_branch_user_of(branch_id));

-- POLICIES: company_charges (somente ADM e matriz)
CREATE POLICY company_charges_adm_all ON public.company_charges
  FOR ALL TO authenticated USING (public.is_adm()) WITH CHECK (public.is_adm());
CREATE POLICY company_charges_matriz_read ON public.company_charges
  FOR SELECT TO authenticated USING (public.is_matriz_of(company_id));

-- TRIGGERS
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER companies_updated_at BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER branches_updated_at BEFORE UPDATE ON public.branches FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER events_updated_at BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER campaigns_set_updated_at BEFORE UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER visitors_updated_at BEFORE UPDATE ON public.visitors FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER company_charges_set_updated_at BEFORE UPDATE ON public.company_charges FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- auto profile + primeiro usuario vira ADM
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.email)
  ON CONFLICT (id) DO NOTHING;

  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'adm') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'adm');
  END IF;

  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- campanha ativa unica por contexto
CREATE OR REPLACE FUNCTION public.close_previous_campaign()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'ativa' THEN
    IF NEW.started_at IS NULL THEN NEW.started_at := now(); END IF;
    UPDATE public.campaigns
      SET status = 'encerrada', ended_at = now()
      WHERE status = 'ativa'
        AND id <> NEW.id
        AND (
          (NEW.branch_id IS NOT NULL AND branch_id = NEW.branch_id)
          OR (NEW.event_id IS NOT NULL AND event_id = NEW.event_id)
        );
  END IF;
  IF NEW.status = 'encerrada' AND NEW.ended_at IS NULL THEN
    NEW.ended_at := now();
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER campaigns_close_previous
BEFORE INSERT OR UPDATE OF status ON public.campaigns
FOR EACH ROW EXECUTE FUNCTION public.close_previous_campaign();

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_adm() FROM anon;
REVOKE EXECUTE ON FUNCTION public.current_company_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.current_branch_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_matriz_of(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_branch_user_of(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.my_company_basics() FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.close_previous_campaign() FROM anon, authenticated;