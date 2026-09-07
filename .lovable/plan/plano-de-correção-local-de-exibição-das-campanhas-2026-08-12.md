# Plano de Correção: Local de Exibição das Campanhas

Este plano visa corrigir o comportamento do seletor de unidades no formulário de campanhas, garantindo que usuários com papel Matriz possam selecionar tanto a própria Matriz quanto suas filiais, enquanto usuários Filial fiquem restritos à sua própria unidade.

## Diagnóstico

A causa raiz identificada é que o componente `src/routes/_authenticated/campanhas.tsx` utiliza uma lógica simplificada no frontend (`singleTarget`) que assume que se houver apenas uma opção disponível para o usuário atual (mesmo que seja apenas a primeira filial retornada pelo banco), ela deve ser fixada e bloqueada. Para usuários Matriz, o sistema estava filtrando ou selecionando automaticamente a primeira filial encontrada, impedindo a escolha da própria Matriz ou de outras filiais. Além disso, a hierarquia no ADM precisava de validação para evitar resíduos ao trocar de empresa.

## Alterações Propostas

### Frontend (`src/routes/_authenticated/campanhas.tsx`)

- Renomear o campo para "Local de exibição da campanha *".
- Adicionar texto auxiliar instrutivo.
- Refatorar a lógica de `targetOptions` para incluir a Matriz explicitamente (usando `is_headquarters` e `company_id`).
- Desabilitar a pré-seleção automática (`singleTarget`) para usuários Matriz, forçando a escolha consciente.
- Para usuários Filial, manter o campo bloqueado exibindo apenas sua unidade.
- Implementar a regra de nomes corporativos (`trade_name` > `legal_name` > `name`) usando a utilidade centralizada `getCompanyDisplayName` e `getBranchDisplayName`.
- Adicionar limpeza de estado no seletor de unidades para o papel ADM ao trocar a empresa selecionada.

### Backend/Segurança

- Reforçar a validação no handler `saveCampaign` para garantir que o `company_id` e `branch_id` gravados correspondam às permissões do usuário autenticado vindas do `useAccess`, ignorando tentativas de manipulação do `target` no payload.
- Garantir que a associação de campanhas respeite a restrição de que `branch_id` ou `event_id` devem ser preenchidos, mas nunca ambos (conforme `campaign_context_check` no DB).

## Verificação Técnica

- Validar se a Matriz consegue ver a si mesma (como Matriz) e todas as suas filiais ativas.
- Confirmar se a Filial vê apenas seu próprio nome e o campo permanece somente leitura.
- Testar o fluxo ADM para garantir que a troca de empresa reseta o local de exibição selecionado.
- Verificar se os nomes exibidos seguem a prioridade de nomes fantasia.
