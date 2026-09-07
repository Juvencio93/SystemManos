-- Clean up redundant policies and ensure strict own-profile access
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile display_name" ON public.profiles;

-- 1. SELECT: User can read their own profile
CREATE POLICY "profiles_select_self" 
ON public.profiles FOR SELECT 
TO authenticated 
USING (auth.uid() = id);

-- 2. INSERT: User can create their own profile (required for upsert)
CREATE POLICY "profiles_insert_self" 
ON public.profiles FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = id);

-- 3. UPDATE: User can update their own profile
CREATE POLICY "profiles_update_self" 
ON public.profiles FOR UPDATE 
TO authenticated 
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 4. ADM Bypass (using the existing is_adm function if available)
-- Note: If is_adm() is defined, we add it to the policies.
CREATE POLICY "adm_view_all_profiles" 
ON public.profiles FOR SELECT 
TO authenticated 
USING (public.is_adm());

-- Final grants check
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
