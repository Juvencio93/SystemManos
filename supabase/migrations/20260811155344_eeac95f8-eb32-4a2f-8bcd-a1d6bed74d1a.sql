WITH latest AS (
  SELECT id, metrics_snapshot, indicators
  FROM operational_analyses
  WHERE analysis_date = '2026-08-11'
  AND status = 'concluido'
  ORDER BY created_at DESC
  LIMIT 1
)
UPDATE operational_analyses
SET ai_result = jsonb_build_object(
  'resumoExecutivo', 'A empresa SOLVER está em fase inicial de acompanhamento. A Matriz e a Solver 2 ainda possuem menos de 14 dias de histórico, portanto não há dados suficientes para avaliar tendência de captação. A Solver 2 registrou 1 conexão nos últimos 7 dias. Recomenda-se manter a divulgação do portal cativo e revisar novamente o desempenho após completar o período mínimo de observação.',
  'prioridades', '[]'::jsonb,
  'destaques', '[]'::jsonb,
  'recomendacoesGerais', jsonb_build_array('Manter a divulgação do portal cativo', 'Revisar desempenho após 14 dias')
),
metrics_snapshot = (
  SELECT jsonb_agg(
    jsonb_set(
      jsonb_set(
        obj, 
        '{status}', 
        '"observacao"'
      ),
      '{reason}',
      '"Em período inicial de acompanhamento (menos de 14 dias). Ainda é cedo para comparar desempenho."'
    )
  )
  FROM (
    SELECT jsonb_array_elements(metrics_snapshot) as obj
    FROM latest
  ) s
)
WHERE id = (SELECT id FROM latest);