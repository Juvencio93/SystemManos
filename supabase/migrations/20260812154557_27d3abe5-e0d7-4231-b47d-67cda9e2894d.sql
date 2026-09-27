-- Ajuste cirúrgico de segurança para a função de gatilho
ALTER FUNCTION public.close_previous_campaign() SET search_path = public;
REVOKE ALL ON FUNCTION public.close_previous_campaign() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.close_previous_campaign() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.close_previous_campaign() TO service_role;
