-- Remover políticas antigas para o bucket 'logos' se existirem
DO $$
BEGIN
    DELETE FROM storage.policies WHERE bucket_id = 'logos';
EXCEPTION WHEN OTHERS THEN
    -- Ignore if table doesn't exist or other errors
END $$;

-- 1. Permitir SELECT (Leitura)
-- Como o bucket é privado (pelo que vimos no erro anterior), 
-- o acesso deve ser via signed URL ou autenticado.
-- Mas para facilitar o preview no browser após upload direto:
CREATE POLICY "Logos Select" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'logos');

-- 2. Permitir INSERT (Upload direto do cliente)
-- Permitimos upload para o diretório 'temp/' ou para o caminho final 
-- O servidor validará depois.
CREATE POLICY "Logos Insert" ON storage.objects FOR INSERT TO authenticated 
WITH CHECK (bucket_id = 'logos');

-- 3. Permitir UPDATE (Substituição)
CREATE POLICY "Logos Update" ON storage.objects FOR UPDATE TO authenticated 
USING (bucket_id = 'logos')
WITH CHECK (bucket_id = 'logos');

-- 4. Permitir DELETE (Limpeza)
CREATE POLICY "Logos Delete" ON storage.objects FOR DELETE TO authenticated 
USING (bucket_id = 'logos');
