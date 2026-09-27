DELETE FROM public.messages 
WHERE content ILIKE '%CHAMADA DE ATENÇÃO%' 
   OR content ILIKE '%chamada de atencao%';