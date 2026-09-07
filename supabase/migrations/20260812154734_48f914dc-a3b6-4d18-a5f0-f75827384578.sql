-- Recriar gatilho e função de forma definitiva com tratamento explícito para Matriz (branch_id IS NULL)
CREATE OR REPLACE FUNCTION public.close_previous_campaign()
RETURNS TRIGGER AS $$
BEGIN
  -- 1. Apenas processa se o status mudar para 'ativa' ou se for inserida como 'ativa'
  IF NEW.status = 'ativa' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'ativa') THEN
    
    -- 2. Define data de início se ausente
    IF NEW.started_at IS NULL THEN 
      NEW.started_at := now(); 
    END IF;

    -- 3. Atualização atômica para encerrar campanhas no MESMO local
    UPDATE public.campaigns
    SET status = 'encerrada', 
        ended_at = now(),
        updated_at = now()
    WHERE status = 'ativa'
      AND id <> NEW.id
      AND company_id = NEW.company_id
      AND (
        (NEW.branch_id IS NOT NULL AND branch_id = NEW.branch_id) -- Mesma Filial
        OR (NEW.event_id IS NOT NULL AND event_id = NEW.event_id) -- Mesmo Evento
        OR (NEW.branch_id IS NULL AND NEW.event_id IS NULL AND branch_id IS NULL AND event_id IS NULL) -- Mesma Sede (Matriz)
      );
  END IF;

  -- 4. Registrar data de término ao encerrar manualmente
  IF NEW.status = 'encerrada' AND (TG_OP = 'UPDATE' AND OLD.status = 'ativa') AND NEW.ended_at IS NULL THEN
    NEW.ended_at := now();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Garantir privilégios
REVOKE ALL ON FUNCTION public.close_previous_campaign() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.close_previous_campaign() TO service_role;

-- Recriar Trigger vinculando aos eventos corretos
DROP TRIGGER IF EXISTS campaigns_close_previous ON public.campaigns;
CREATE TRIGGER campaigns_close_previous
BEFORE INSERT OR UPDATE OF status ON public.campaigns
FOR EACH ROW
EXECUTE FUNCTION public.close_previous_campaign();

-- Índice para performance da busca atômica
CREATE INDEX IF NOT EXISTS idx_campaigns_status_context 
ON public.campaigns (status, company_id, branch_id, event_id) 
WHERE status = 'ativa';
