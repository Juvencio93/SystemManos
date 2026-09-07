-- 1. Trocar política events_matriz_all por events_matriz_read (apenas SELECT)
DROP POLICY IF EXISTS events_matriz_all ON public.events;

CREATE POLICY events_matriz_read
ON public.events
FOR SELECT
TO authenticated
USING (public.is_matriz_of(company_id));

-- 2. Adicionar coluna is_headquarters na tabela branches
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'branches' AND COLUMN_NAME = 'is_headquarters') THEN
        ALTER TABLE public.branches ADD COLUMN is_headquarters boolean DEFAULT false;
    END IF;
END $$;
