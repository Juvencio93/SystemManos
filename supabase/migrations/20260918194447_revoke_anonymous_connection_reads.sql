-- Connection records include visitor identifiers and network metadata. They are
-- written/read through authenticated application flows or server-side jobs; an
-- unauthenticated Data API client has no legitimate access path.
ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.connections FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.connections TO authenticated;
GRANT ALL ON TABLE public.connections TO service_role;
