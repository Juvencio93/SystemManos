ALTER TABLE public.company_charges
  ADD COLUMN stripe_payment_intent_id text,
  ADD COLUMN stripe_pix_qr_code text,
  ADD COLUMN stripe_pix_copy_paste text;

CREATE UNIQUE INDEX company_charges_stripe_payment_intent_id_unique
  ON public.company_charges (stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

COMMENT ON COLUMN public.company_charges.stripe_payment_intent_id IS
  'Stripe PaymentIntent used for direct PIX payments.';
COMMENT ON COLUMN public.company_charges.stripe_pix_qr_code IS
  'Stripe-hosted PNG URL for the direct PIX QR Code.';
COMMENT ON COLUMN public.company_charges.stripe_pix_copy_paste IS
  'PIX EMV copy-and-paste payload supplied by Stripe.';
