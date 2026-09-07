-- Policies para o bucket logos
DO $$ 
BEGIN
    -- Permitir leitura pública (mesmo sendo privado, RLS permite isso se quisermos URLs públicas acessíveis)
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public Access' AND tablename = 'objects' AND schemaname = 'storage') THEN
        CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'logos');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'ADM can upload to platform' AND tablename = 'objects' AND schemaname = 'storage') THEN
        CREATE POLICY "ADM can upload to platform" 
        ON storage.objects FOR INSERT 
        TO authenticated 
        WITH CHECK (
          bucket_id = 'logos' AND 
          (storage.foldername(name))[1] = 'plataforma' AND
          public.has_role(auth.uid(), 'adm')
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Matriz can upload to company folder' AND tablename = 'objects' AND schemaname = 'storage') THEN
        CREATE POLICY "Matriz can upload to company folder" 
        ON storage.objects FOR INSERT 
        TO authenticated 
        WITH CHECK (
          bucket_id = 'logos' AND 
          (storage.foldername(name))[1] = 'empresas' AND
          (storage.foldername(name))[2] = (
            SELECT company_id::text FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1
          )
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Branch can upload to branch folder' AND tablename = 'objects' AND schemaname = 'storage') THEN
        CREATE POLICY "Branch can upload to branch folder" 
        ON storage.objects FOR INSERT 
        TO authenticated 
        WITH CHECK (
          bucket_id = 'logos' AND 
          (storage.foldername(name))[1] = 'filiais' AND
          (storage.foldername(name))[2] = (
            SELECT branch_id::text FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1
          )
        );
    END IF;
END $$;
