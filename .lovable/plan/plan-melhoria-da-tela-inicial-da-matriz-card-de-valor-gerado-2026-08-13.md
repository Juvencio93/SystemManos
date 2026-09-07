# Plan: Melhoria da Tela Inicial da Matriz — Card de Valor Gerado

Substituir o card "Comparativo mensal de custos" por um novo card compacto que demonstra o valor real gerado pela Manos Tech para usuários do tipo Matriz.

## User Review Required

> [!IMPORTANT]
> A implementação depende da existência de um valor de mensalidade real na tabela `companies` (coluna `monthly_price`). Vou validar se esse dado está preenchido para a Matriz logada. Se não houver, o campo "Seu investimento" não será exibido para evitar dados simulados.

- **Origem dos dados:**
  - **Conexões do mês:** Contagem de registros na tabela `connections` filtrada pela empresa e filiais no mês atual.
  - **Novos contatos do mês:** Contagem de `visitor_id` únicos na tabela `connections` (onde `is_returning` é falso) no mês atual.
  - **Campanhas realizadas:** Contagem de campanhas com status `ativa`, `finalizada` ou `pausada` (excluindo `rascunho`) que tiveram atividade no mês.
  - **Mensalidade:** Valor da coluna `monthly_price` na tabela `companies`.

## Proposed Changes

### Logic & Data Fetching

- **`src/lib/company.server.ts`**:
  - Enriquecer o `computeCompanySnapshot` para incluir as métricas específicas solicitadas: conexões do mês, novos contatos únicos do mês e campanhas ativas/realizadas no mês.
  - Implementar a lógica de pluralização correta para as métricas.
  - Adicionar o cálculo da "Operação Manual" baseado na remuneração de referência (`MIN_WAGE * ENCARGOS_MULTIPLIER` = R$ 2.755,70).
  - Validar a fórmula antiga: O valor de R$ 2.655,70 parece ser uma constante antiga; a nova referência será atualizada para refletir o custo operacional estimado atual.

### Frontend Components

- **`src/components/app/ai-agent-card.tsx`**:
  - Refatorar a renderização do card para o papel `matriz`.
  - Implementar o novo layout: Título com destaque em ciano, métricas em linha centralizada e investimento à direita.
  - Criar o modal "Manos Tech x operação manual" com o detalhamento dos custos e a explicação da economia operacional estimada.
  - Garantir a responsividade (Desktop: horizontal, Mobile: empilhado).

### Validation

- Validar isolamento por `companyId`.
- Testar estados de carregamento e ausência de dados.
- Verificar singular/plural em todas as métricas.

## Technical Details

- **Fórmula de Economia:** `Economia = (Custo Operação Manual * N unidades) - Mensalidade Manos Tech`.
- **Custo Operação Manual:** Referência de R$ 2.755,70 por unidade (Salário Mínimo R$ 1.621,00 * 1.7 de encargos/benefícios).
- **Isolamento:** Uso estrito do `companyId` vindo da autenticação via Supabase.
