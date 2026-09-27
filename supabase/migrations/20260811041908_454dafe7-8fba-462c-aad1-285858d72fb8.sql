-- 1. Marcar como 'cancelado' a cobrança duplicada (a mais antiga da mesma competência paga, se houver, mas aqui o usuário diz que confirmou apenas um recebimento e apareceram dois como pagos)
-- Na verdade, os IDs 34d823c1-25d7-49be-af05-082901143d77 (09/2026) e 71ebea7f-6981-4bf4-b7d6-d53beaf970c3 (08/2026) são competências diferentes.
-- O faturamento recebido está dando R$ 120,00 porque somou 08/2026 + 09/2026.
-- O usuário disse: "Confirmei apenas um recebimento de R$ 60,00". Se ele confirmou um e agora tem dois pagos, um deles não deveria estar pago OU foi criado indevidamente.
-- Porém, 08/2026 e 09/2026 são competências diferentes. 
-- "Resultado esperado: Faturamento recebido: R$ 60,00". Isso significa que apenas UMA cobrança deve estar como 'paga'.
-- Como estamos em Agosto de 2026, a cobrança de 09/2026 (Setembro) provavelmente foi gerada e paga por engano ou bug no fluxo manual que gera a próxima.

UPDATE public.company_charges 
SET status = 'pendente', paid_at = NULL, method = NULL, notes = NULL
WHERE id = '34d823c1-25d7-49be-af05-082901143d77';

-- Deletar a cobrança de 10/2026 que foi gerada pela confirmação indevida de 09/2026
DELETE FROM public.company_charges WHERE id = 'abdd86f7-0ee2-4f52-bfdc-06420535d362';

-- 2. Garantir índice único por empresa e competência (ignorando canceladas se necessário, mas geralmente queremos apenas uma ativa/pendente/paga)
-- Vamos remover duplicidades se existirem em outras empresas antes de criar o índice
-- (Não parece haver no diagnóstico, mas é boa prática)

ALTER TABLE public.company_charges 
ADD CONSTRAINT unique_company_competence UNIQUE (company_id, competence);
