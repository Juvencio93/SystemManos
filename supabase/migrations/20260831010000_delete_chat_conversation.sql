-- Permanently delete a conversation and its messages when the user chooses
-- "Excluir conversa". Access is limited to participants (or ADM), and the
-- operation is atomic so no orphaned chat data remains.
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
  AND NOT public.has_role(auth.uid(), 'admin') THEN
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
