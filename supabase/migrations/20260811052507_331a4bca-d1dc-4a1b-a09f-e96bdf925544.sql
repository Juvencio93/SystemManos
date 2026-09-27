-- 1. Add ai_daily_command_limit to companies
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS ai_daily_command_limit integer NOT NULL DEFAULT 20;

-- 2. Add ai_usage to branches (to track daily consumption)
-- Note: Matriz also has a branch row (is_headquarters = true)
ALTER TABLE public.branches
ADD COLUMN IF NOT EXISTS ai_usage_today integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS ai_usage_last_reset_at timestamp with time zone DEFAULT now();

-- 3. Function to reset daily usage based on America/Sao_Paulo
CREATE OR REPLACE FUNCTION public.reset_daily_ai_usage()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    today_sp date;
BEGIN
    today_sp := (now() AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo')::date;
    
    UPDATE public.branches
    SET ai_usage_today = 0,
        ai_usage_last_reset_at = now()
    WHERE (ai_usage_last_reset_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo')::date < today_sp;
END;
$$;

-- 4. Function to get AI limits distribution
CREATE OR REPLACE FUNCTION public.get_ai_limits_distribution(_company_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    total_limit integer;
    matriz_limit integer := 10;
    pool_filiais integer;
    active_filiais_count integer;
    filial_limit integer := 0;
    bonus_limit integer := 0;
BEGIN
    SELECT ai_daily_command_limit INTO total_limit 
    FROM public.companies 
    WHERE id = _company_id;

    IF total_limit IS NULL THEN
        total_limit := 20;
    END IF;

    pool_filiais := total_limit - matriz_limit;
    IF pool_filiais < 0 THEN pool_filiais := 0; END IF;

    SELECT count(*)::integer INTO active_filiais_count
    FROM public.branches
    WHERE company_id = _company_id 
      AND active = true 
      AND is_headquarters = false;

    IF active_filiais_count > 0 THEN
        filial_limit := pool_filiais / active_filiais_count;
        bonus_limit := pool_filiais % active_filiais_count;
    END IF;

    RETURN json_build_object(
        'total_limit', total_limit,
        'matriz_limit', matriz_limit,
        'pool_filiais', pool_filiais,
        'active_filiais_count', active_filiais_count,
        'filial_limit', filial_limit,
        'bonus_limit', bonus_limit
    );
END;
$$;