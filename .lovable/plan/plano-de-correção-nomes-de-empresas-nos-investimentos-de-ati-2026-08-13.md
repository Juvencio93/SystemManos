# Plano de Correção: Nomes de Empresas nos Investimentos de Ativação

O objetivo é garantir que a página de **Investimentos de Ativação** exiba exclusivamente o **Nome Fantasia** (ou Razão Social) oficial do cadastro de Matrizes e Filiais, ignorando nomes personalizados de usuários ou apelidos da tela inicial.

## Auditoria Realizada

- **Origem dos Nomes Incorretos:** O campo `companies.name` estava sendo utilizado em alguns casos, e este campo continha nomes como "Jéssica" ou "SOLVER", que são apelidos informais ou parciais. Além disso, o sistema estava priorizando o campo `name` legado em vez do `trade_name` (Nome Fantasia).
- **Dados Observados:**
  - Registro "Jéssica": Pertence à empresa `JESSICA ALINE CAMPOS`. Nome Fantasia correto: `PANIFICADORA, CONFEITARIA E CAFETERIA CAMPOS`.
  - Registro "SOLVER": Pertence à empresa `SOLVER SEGURANCA ELETRONICA LTDA`. Nome Fantasia correto: `SOLVER PATRIMONIAL`.
  - Registro "40.448.734 MAYRA MACHADO": Pertence ao `Boteco do Barao`.
- **Causa Raiz:** O componente `despesas.tsx` utiliza `e.companies?.name` e `e.branches?.name` diretamente no mapeamento da tabela, sem aplicar a lógica de prioridade definida em `name-utils.ts`.

## Ações a Serem Tomadas

### 1. Frontend: Atualização da Listagem

- Modificar `src/routes/_authenticated/financeiro/despesas.tsx`.
- Importar `getCompanyDisplayName` e `getBranchDisplayName` de `@/lib/name-utils`.
- Substituir a exibição direta de `e.companies?.name` e `e.branches?.name` pelas funções utilitárias que garantem a prioridade: `Nome Fantasia` > `Razão Social` > `Nome`.

### 2. Frontend: Atualização do Modal de Cadastro/Edição

- No modal de criação de despesas, o `SelectItem` da lista de empresas também utiliza `comp.name`.
- Atualizar para utilizar a lógica de `getCompanyDisplayName` para que o administrador selecione a empresa pelo nome correto.

### 3. Backend: Garantia de Dados no Fetcher

- Verificar `getFinanceiroStats` em `src/lib/financeiro.functions.ts`.
- Garantir que a query do Supabase para `expenses` inclua `trade_name` e `legal_name` tanto para `companies` quanto para `branches`.

## Preservação e Segurança

- Não haverá alteração no banco de dados.
- Não haverá alteração na lógica de "Nome de Saudação" da tela inicial (que usa o `display_name` do perfil).
- O total de investimentos e outros valores financeiros permanecerão intactos.

## Validação

- Verificação visual dos 3 registros citados.
- Teste de criação e edição com os novos nomes.
- Build de produção e checagem de tipos.
