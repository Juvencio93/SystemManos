DROP TRIGGER IF EXISTS campaigns_close_previous ON public.campaigns;
CREATE TRIGGER campaigns_close_previous
BEFORE INSERT OR UPDATE OF status ON public.campaigns
FOR EACH ROW EXECUTE FUNCTION public.close_previous_campaign();

DROP TRIGGER IF EXISTS campaigns_set_updated_at ON public.campaigns;
CREATE TRIGGER campaigns_set_updated_at
BEFORE UPDATE ON public.campaigns
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();