-- Corrige verificações de papel para usar o enum válido public.app_role ('adm').
-- Também substitui as policies de análise operacional que comparavam com 'admin'.

CREATE OR REPLACE FUNCTION public.chat_delete_conversation(p_conversation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.conversation_participants cp
    WHERE cp.conversation_id = p_conversation_id
      AND cp.profile_id = auth.uid()
  )
  AND NOT public.has_role(auth.uid(), 'adm') THEN
    RAISE EXCEPTION 'Sem permissão para excluir esta conversa';
  END IF;

  DELETE FROM public.conversations
  WHERE id = p_conversation_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conversa não encontrada';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.chat_delete_conversation(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.chat_delete_conversation(uuid) TO authenticated;

DROP POLICY IF EXISTS "Admins can manage operational_analyses" ON public.operational_analyses;
CREATE POLICY "Admins can manage operational_analyses"
ON public.operational_analyses
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'adm'))
WITH CHECK (public.has_role(auth.uid(), 'adm'));

DROP POLICY IF EXISTS "Admins can manage operational_alerts" ON public.operational_alerts;
CREATE POLICY "Admins can manage operational_alerts"
ON public.operational_alerts
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'adm'))
WITH CHECK (public.has_role(auth.uid(), 'adm'));
