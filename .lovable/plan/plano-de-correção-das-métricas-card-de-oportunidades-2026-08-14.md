# Plano de Correção das Métricas - Card de OPORTUNIDADES

O objetivo é garantir que o card "Transformando conexões em OPORTUNIDADES" apresente métricas confiáveis e precisas de **Conexões** e **Novos Contatos** do mês atual, com isolamento correto de dados para a Matriz e suas Filiais.

## Mudanças Técnicas

### Backend (Métricas e Consultas)

- **Arquivo**: `src/lib/company.server.ts`
- **Função**: `computeCompanySnapshot`
- **Alterações**:
  - **Conexões**: Unificar a lógica para contar todos os registros de `connections` no mês atual vinculados à Matriz (`branch_id IS NULL` + `company_id`) ou suas filiais.
  - **Novos Contatos**: Implementar a lógica de "Primeira Captação". Identificar visitantes únicos (`visitor_id`) que se conectaram no mês e verificar se **não** possuem conexões anteriores à data de início do mês na operação daquela empresa.
  - **Remover Campanhas**: Eliminar a contagem e retorno da métrica `campanhasMes` do snapshot.
  - **Filiais Ativas**: Garantir que a contagem de filiais (`activeBranchesCount`) exclua registros marcados como `is_headquarters`.

### Frontend (Interface e Apresentação)

- **Arquivo**: `src/components/app/ai-agent-card.tsx`
- **Componente**: `ClientAiAgentCard`
- **Alterações**:
  - **Remover Campanhas**: Retirar o display da métrica de campanhas.
  - **Apresentação das Métricas**: Exibir `X conexões · Y novos contatos` em uma única linha (desktop), com negrito nos números e respeitando singular/plural.
  - **Escopo Dinâmico**: Atualizar o texto de escopo conforme o número de filiais ativas (ex: "Resultados consolidados entre Matriz e 2 Filiais.").
  - **Tratamento de Erros**: Garantir que erros de carregamento exibam a mensagem amigável solicitada em vez de zero silencioso.

## Auditoria e Verificação

- Utilizar `visitor_id` como identificador estável para deduplicação.
- Verificar a data de `created_at` na tabela `connections` como fonte da verdade para a primeira captação.
- Validar se o fuso horário (America/Sao_Paulo) está sendo respeitado no cálculo do início do mês.

## Restrições

- Não alterar outras páginas, CRM, Gerente Operacional ou banco de dados.
- Manter o layout e estilo visual aprovado.
