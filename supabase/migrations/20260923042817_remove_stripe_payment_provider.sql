UPDATE public.company_charges SET payment_provider = 'manual', method = COALESCE(method, 'Manual') WHERE payment_provider = 'stripe';
UPDATE public.payment_provider_preferences SET provider = 'asaas' WHERE provider = 'stripe';

DROP TABLE public.stripe_integrations;
ALTER TABLE public.company_charges DROP CONSTRAINT company_charges_payment_provider_check;
ALTER TABLE public.company_charges
  DROP COLUMN stripe_checkout_session_id,
  DROP COLUMN stripe_last_event_id,
  DROP COLUMN stripe_payment_intent_id,
  DROP COLUMN stripe_pix_qr_code,
  DROP COLUMN stripe_pix_copy_paste,
  ADD CONSTRAINT company_charges_payment_provider_check CHECK (payment_provider IN ('asaas', 'pagbank', 'manual'));
ALTER TABLE public.payment_provider_preferences DROP CONSTRAINT payment_provider_preferences_provider_check;
ALTER TABLE public.payment_provider_preferences ADD CONSTRAINT payment_provider_preferences_provider_check CHECK (provider IN ('asaas', 'pagbank'));
