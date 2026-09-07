# Plano de Implementação - Linha do Tempo de Acessos no CRM

Implementar o "Histórico de Acessos" no CRM de Visitantes para permitir a visualização detalhada de todas as conexões autorizadas de um visitante, respeitando as regras de identidade única e isolamento por empresa/unidade.

## Alterações Técnicas

### 1. Funções de Servidor

- **Arquivo:** `src/lib/crm.functions.ts` (Novo)
- Criar a função `getVisitorHistory` usando `createServerFn`.
- **Lógica:**
  - Validar autenticação e papel do usuário (ADM, Matriz, Filial).
  - Buscar em `connections` filtrando por `visitor_id` e `company_id`.
  - **Filtro de Unidade (Branch):**
    - Usuários `filial` veem apenas conexões de seu `branch_id`.
    - Usuários `matriz` veem conexões da Matriz e todas as suas Filiais.
    - Usuários `adm` veem tudo conforme o contexto administrativo.
  - Resolver nomes de unidades (Matriz, Filial, Evento) em lote para evitar N+1.
  - Implementar paginação (20 registros iniciais + cursor/offset).
  - Ordenar por `created_at DESC`.
  - Enriquecer dados: identificar "Primeiro acesso" (o registro mais antigo da consulta) e "Retorno".

### 2. Componentes de UI

- **Arquivo:** `src/components/app/crm/VisitorHistoryModal.tsx` (Novo)
- Modal (Dialog da shadcn/ui) ou Painel Lateral (Sheet).
- Exibir resumo no topo: Total de acessos, Primeira captação, Último acesso, Unidades visitadas.
- Linha do tempo compacta e responsiva.
- Ícones discretos para tipos de unidade.
- Botão "Carregar mais" se houver mais páginas.
- Tratamento de estados de carregamento, erro e vazio.

### 3. Integração no CRM

- **Arquivo:** `src/routes/_authenticated/visitantes.tsx`
- Adicionar ação "Ver histórico" na listagem de visitantes (ex: ícone de histórico ou botão discreto na célula do visitante).
- Acionar o modal/painel passando o `visitor_id`.

## Detalhes de Implementação

- **Privacidade:** Telefone será exibido conforme a regra de visualização atual (mascarado se necessário).
- **Desempenho:** Carregamento sob demanda (lazy load).
- **Tipagem:** Criar tipos explícitos para o histórico e unidades, evitando `any`.
- **Identificação de Unidade:**
  - Se `branch_id` é nulo, buscar dados da `company`.
  - Se `branch_id` existe, buscar dados da `branch`.
  - Se houver `event_id`, buscar dados do `event`.

## Validação

- Testar com o caso "Boteco do Barão" (visitante com múltiplos acessos).
- Validar isolamento entre empresas (empresa B não pode ver histórico da empresa A).
- Validar restrição de filial (filial X não vê histórico na matriz/filial Y).
- Build, Lint e TypeScript check (Código 0).
