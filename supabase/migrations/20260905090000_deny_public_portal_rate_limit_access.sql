-- The rate-limit table is service-role-only. Keep RLS enabled and add an
-- explicit deny policy so security tooling can distinguish intentional
-- isolation from a table accidentally left without policies.
CREATE POLICY "portal_checkin_rate_limits_deny_all"
ON public.portal_checkin_rate_limits
AS RESTRICTIVE
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);
