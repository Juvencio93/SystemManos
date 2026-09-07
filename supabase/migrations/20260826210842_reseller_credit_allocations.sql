CREATE TABLE IF NOT EXISTS public.reseller_credit_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id uuid NOT NULL REFERENCES public.resellers(id) ON DELETE CASCADE,
  credit_lot_id uuid NOT NULL REFERENCES public.reseller_credit_lots(id) ON DELETE RESTRICT,
  unit_type text NOT NULL CHECK (unit_type IN ('matriz', 'filial')),
  unit_id uuid NOT NULL,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE CASCADE,
  allocated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (unit_type = 'matriz' AND branch_id IS NULL AND unit_id = company_id)
    OR (unit_type = 'filial' AND branch_id IS NOT NULL AND unit_id = branch_id)
  )
);

CREATE INDEX IF NOT EXISTS reseller_credit_allocations_lookup_idx
  ON public.reseller_credit_allocations (reseller_id, unit_type, unit_id, expires_at DESC);

ALTER TABLE public.reseller_credit_allocations ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reseller_credit_allocations TO authenticated;
GRANT ALL ON public.reseller_credit_allocations TO service_role;

DROP POLICY IF EXISTS "ADM manages reseller credit allocations" ON public.reseller_credit_allocations;
CREATE POLICY "ADM manages reseller credit allocations"
ON public.reseller_credit_allocations
FOR ALL
TO authenticated
USING (public.has_role((select auth.uid()), 'adm'))
WITH CHECK (public.has_role((select auth.uid()), 'adm'));

CREATE OR REPLACE FUNCTION public.reseller_refresh_credit_coverage(p_reseller_id uuid)
RETURNS TABLE (allocated_count integer, pending_count integer, covered_until timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  unit_row record;
  lot_row record;
  allocation_expires_at timestamptz;
  allocated_total integer := 0;
  pending_total integer := 0;
  latest_coverage timestamptz := null;
BEGIN
  IF NOT public.has_role((select auth.uid()), 'adm') THEN
    RAISE EXCEPTION 'Sem permissão para administrar créditos de revenda.';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_reseller_id::text, 0)
  );

  IF NOT EXISTS (
    SELECT 1
    FROM public.resellers r
    WHERE r.id = p_reseller_id
      AND r.status = 'ativa'
  ) THEN
    RAISE EXCEPTION 'Revenda não encontrada ou suspensa.';
  END IF;

  FOR unit_row IN
    SELECT unit_type, unit_id, company_id, branch_id
    FROM (
      SELECT
        'matriz'::text AS unit_type,
        c.id AS unit_id,
        c.id AS company_id,
        null::uuid AS branch_id,
        0 AS unit_order
      FROM public.companies c
      WHERE c.reseller_id = p_reseller_id
        AND c.status = 'ativa'
        AND c.blocked = false
      UNION ALL
      SELECT
        'filial'::text AS unit_type,
        b.id AS unit_id,
        b.company_id,
        b.id AS branch_id,
        1 AS unit_order
      FROM public.branches b
      JOIN public.companies c ON c.id = b.company_id
      WHERE c.reseller_id = p_reseller_id
        AND c.status = 'ativa'
        AND c.blocked = false
        AND b.active = true
    ) units
    ORDER BY unit_order, unit_id
  LOOP
    SELECT a.expires_at
    INTO allocation_expires_at
    FROM public.reseller_credit_allocations a
    WHERE a.reseller_id = p_reseller_id
      AND a.unit_type = unit_row.unit_type
      AND a.unit_id = unit_row.unit_id
      AND a.expires_at > now()
    ORDER BY a.expires_at DESC
    LIMIT 1;

    IF allocation_expires_at IS NOT NULL THEN
      latest_coverage := greatest(latest_coverage, allocation_expires_at);
      CONTINUE;
    END IF;

    SELECT l.id, l.expires_at
    INTO lot_row
    FROM public.reseller_credit_lots l
    WHERE l.reseller_id = p_reseller_id
      AND l.remaining_quantity > 0
      AND l.expires_at > now()
    ORDER BY l.expires_at ASC, l.purchased_at ASC
    FOR UPDATE
    LIMIT 1;

    IF lot_row.id IS NULL THEN
      pending_total := pending_total + 1;
      CONTINUE;
    END IF;

    UPDATE public.reseller_credit_lots
    SET remaining_quantity = remaining_quantity - 1
    WHERE id = lot_row.id;

    INSERT INTO public.reseller_credit_allocations (
      reseller_id,
      credit_lot_id,
      unit_type,
      unit_id,
      company_id,
      branch_id,
      expires_at
    ) VALUES (
      p_reseller_id,
      lot_row.id,
      unit_row.unit_type,
      unit_row.unit_id,
      unit_row.company_id,
      unit_row.branch_id,
      lot_row.expires_at
    );

    allocated_total := allocated_total + 1;
    latest_coverage := greatest(latest_coverage, lot_row.expires_at);
  END LOOP;

  RETURN QUERY SELECT allocated_total, pending_total, latest_coverage;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reseller_refresh_credit_coverage(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reseller_refresh_credit_coverage(uuid) TO authenticated;
