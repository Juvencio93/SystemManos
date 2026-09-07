DELETE FROM public.company_charges 
WHERE company_id = 'c7ada6f9-fd56-4572-8a10-2338a7a8fe42' 
AND due_date = '2026-09-10' 
AND status = 'pendente' 
AND external_id IS NULL;