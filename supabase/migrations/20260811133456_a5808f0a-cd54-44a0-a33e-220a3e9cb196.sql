-- Garantir que as políticas de RLS no storage.objects permitam o fluxo de upload direto
-- Bucket ID: 'logos'

-- 1. Permitir SELECT (Leitura)
-- Como o bucket é privado, SELECT só funciona via signed URL ou se houver política.
-- Criamos uma política para usuários autenticados verem o bucket 'logos'.
CREATE POLICY "Logos Authenticated Select" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'logos');

-- 2. Permitir INSERT (Upload temporário pelo cliente)
CREATE POLICY "Logos Authenticated Insert" ON storage.objects FOR INSERT TO authenticated 
WITH CHECK (bucket_id = 'logos');

-- 3. Permitir UPDATE (Necessário para upsert no storage.upload)
CREATE POLICY "Logos Authenticated Update" ON storage.objects FOR UPDATE TO authenticated 
USING (bucket_id = 'logos')
WITH CHECK (bucket_id = 'logos');

-- 4. Permitir DELETE (Para que o servidor limpe arquivos temporários após validação)
CREATE POLICY "Logos Authenticated Delete" ON storage.objects FOR DELETE TO authenticated 
USING (bucket_id = 'logos');
