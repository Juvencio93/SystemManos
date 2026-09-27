-- Defence in depth: browser and authenticated user sessions never access these grants.
CREATE POLICY "no direct application access"
ON public.hotspot_access_grants
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);
