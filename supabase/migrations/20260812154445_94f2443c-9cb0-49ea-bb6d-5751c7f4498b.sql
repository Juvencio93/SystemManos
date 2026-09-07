-- Atualização cirúrgica para garantir a troca automática de campanhas no contexto de Matriz (branch_id IS NULL)
-- e correção do gatilho para ser atômico e cobrir todos os cenários solicitados.

CREATE OR REPLACE FUNCTION public.close_previous_campaign()
RETURNS TRIGGER AS $$
BEGIN
  -- Regra: Apenas quando uma campanha é definida como 'ativa'
  IF NEW.status = 'ativa' THEN
    
    -- Definir data de início se não existir
    IF NEW.started_at IS NULL THEN 
      NEW.started_at := now(); 
    END IF;

    -- Encerrar a campanha anterior no MESMO local (branch_id ou event_id)
    -- Matriz: branch_id IS NULL AND event_id IS NULL AND company_id = NEW.company_id
    -- Filial: branch_id = NEW.branch_id
    -- Evento: event_id = NEW.event_id
    UPDATE public.campaigns
    SET status = 'encerrada', 
        ended_at = now(),
        updated_at = now()
    WHERE status = 'ativa'
      AND id <> NEW.id
      AND company_id = NEW.company_id -- Garante isolamento por empresa/matriz
      AND (
        (NEW.branch_id IS NOT NULL AND branch_id = NEW.branch_id) -- Mesma Filial
        OR (NEW.event_id IS NOT NULL AND event_id = NEW.event_id) -- Mesmo Evento
        OR (NEW.branch_id IS NULL AND NEW.event_id IS NULL AND branch_id IS NULL AND event_id IS NULL) -- Mesma Sede (Matriz)
      );
  END IF;

  -- Se for encerrada manualmente, registrar a data de término
  IF NEW.status = 'encerrada' AND OLD.status = 'ativa' AND NEW.ended_at IS NULL THEN
    NEW.ended_at := now();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-aplicar o trigger para garantir que ele monitore as mudanças de status corretamente
DROP TRIGGER IF EXISTS campaigns_close_previous ON public.campaigns;

CREATE TRIGGER campaigns_close_previous
BEFORE INSERT OR UPDATE OF status, branch_id, event_id ON public.campaigns
FOR EACH ROW
EXECUTE FUNCTION public.close_previous_campaign();

-- Adicionar índice para performance da troca atômica
CREATE INDEX IF NOT EXISTS idx_campaigns_active_context 
ON public.campaigns (company_id, branch_id, event_id) 
WHERE status = 'ativa';

GRANT EXECUTE ON FUNCTION public.close_previous_campaign() TO service_role;
