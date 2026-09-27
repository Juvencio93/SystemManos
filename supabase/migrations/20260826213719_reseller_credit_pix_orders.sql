ALTER TABLE public.resellers
  ADD COLUMN IF NOT EXISTS asaas_customer_id text;

CREATE TABLE IF NOT EXISTS public.reseller_credit_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id uuid NOT NULL REFERENCES public.resellers(id) ON DELETE CASCADE,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price numeric(10, 2) NOT NULL DEFAULT 50.00 CHECK (unit_price >= 0),
  total_amount numeric(10, 2) NOT NULL CHECK (total_amount >= 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'overdue', 'cancelled')),
  asaas_payment_id text UNIQUE,
  asaas_pix_qr_code text,
  asaas_pix_copy_paste text,
  due_date date NOT NULL,
  confirmed_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (total_amount = quantity * unit_price)
);

CREATE INDEX IF NOT EXISTS reseller_credit_orders_reseller_status_idx
  ON public.reseller_credit_orders (reseller_id, status, created_at DESC);

ALTER TABLE public.reseller_credit_orders ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reseller_credit_orders TO authenticated;
GRANT ALL ON public.reseller_credit_orders TO service_role;

DROP POLICY IF EXISTS "ADM manages reseller credit orders" ON public.reseller_credit_orders;
CREATE POLICY "ADM manages reseller credit orders"
ON public.reseller_credit_orders
FOR ALL
TO authenticated
USING (public.has_role((select auth.uid()), 'adm'))
WITH CHECK (public.has_role((select auth.uid()), 'adm'));

CREATE OR REPLACE FUNCTION public.reseller_confirm_credit_order(
  p_asaas_payment_id text,
  p_confirmed_at timestamptz DEFAULT now()
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  order_row public.reseller_credit_orders%ROWTYPE;
BEGIN
  SELECT * INTO order_row
  FROM public.reseller_credit_orders
  WHERE asaas_payment_id = p_asaas_payment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF order_row.status = 'confirmed' THEN
    RETURN true;
  END IF;

  UPDATE public.reseller_credit_orders
  SET status = 'confirmed', confirmed_at = p_confirmed_at, updated_at = now()
  WHERE id = order_row.id;

  INSERT INTO public.reseller_credit_lots (
    reseller_id,
    quantity,
    remaining_quantity,
    source,
    reference,
    purchased_at,
    expires_at,
    created_by
  ) VALUES (
    order_row.reseller_id,
    order_row.quantity,
    order_row.quantity,
    'asaas',
    'PIX Asaas - pedido ' || order_row.id::text,
    p_confirmed_at,
    p_confirmed_at + interval '30 days',
    order_row.created_by
  );

  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reseller_confirm_credit_order(text, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reseller_confirm_credit_order(text, timestamptz) TO service_role;
