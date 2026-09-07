# Plano de Implementação — Financeiro ADM (Responsividade, Despesas e Lucro Real)

Este plano descreve as alterações cirúrgicas no módulo Financeiro para melhorar a responsividade, implementar o controle de despesas e exibir o lucro real, conforme solicitado.

## 1. Banco de Dados e API

- **Schema `expenses`**: Otimizar a tabela existente para suportar os novos campos: `matriz_id` (obrigatória), `filial_id` (opcional), `tipo` (Ativação Matriz/Filial), `categoria` (Materiais, Deslocamento, Sistema, Outros), `descricao`, `valor`, `data` e `observacao`.
- **Server Functions**:
  - Refatorar `getFinanceiroStats` em `src/lib/financeiro.functions.ts` para retornar a soma das despesas filtradas pelo período selecionado.
  - Implementar lógica de "Lucro Real" no servidor: `faturamentoConfirmado - totalDespesas`.

## 2. Interface do Dashboard Financeiro (`src/routes/_authenticated/financeiro/index.tsx`)

- **Novos Cards**:
  - **Despesas**: Exibe o total de despesas do período. Clique redireciona para `/financeiro/despesas`.
  - **Lucro Real**: Exibe o resultado da fórmula.
    - Se > 0: "Lucro realizado" (Verde).
    - Se < 0: "Investimento a recuperar" (Amarelo/Laranja).
- **Responsividade**: Ajustar o grid de cards para `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5` (ou similar) para acomodar os novos cards sem quebrar o layout.

## 3. Telas de Listagem (Responsividade)

- **A Receber e Em Atraso**:
  - Converter tabelas em **Cards Mobile** quando a largura da tela for pequena.
  - Garantir que nenhum texto ou botão seja cortado usando `truncate`, `flex-wrap` e larguras mínimas seguras.
  - Implementar `overflow-x-auto` com `min-w` nas tabelas desktop para evitar esmagamento em tablets.

## 4. Gerenciamento de Despesas (`src/routes/_authenticated/financeiro/despesas.tsx`)

- **Formulário de Cadastro**:
  - Select de Empresa Matriz (Obrigatório).
  - Select de Filial (Opcional, filtrado pela Matriz selecionada).
  - Select de Categoria: Materiais, Deslocamento, Sistema, Outros.
  - Inputs: Descrição, Valor, Data, Observação.
- **Filtros**: Adicionar filtros por período, Matriz, Filial e Categoria.

## Notas Técnicas

- As despesas são apenas para controle interno e não afetam MRR, faturas do Asaas ou valores dos planos.
- O Lucro Real considera apenas o faturamento **efetivamente recebido** (`paid_at` no período).
- Timezone padrão: `America/Sao_Paulo`.

Nenhuma outra parte do sistema será alterada.
