-- ADM/Suporte must be able to reply to legacy support threads whose only
-- stored participant is the reseller or client account. Keep all other users
-- constrained by the normal conversation access check.
DROP POLICY IF EXISTS "Users can insert messages" ON public.messages;
CREATE POLICY "Users can insert messages"
ON public.messages FOR INSERT
TO authenticated
WITH CHECK (
  public.check_conversation_access(conversation_id, auth.uid())
  OR public.has_role(auth.uid(), 'adm')
);
