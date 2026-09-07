# Lote 3: Componentes de Gráficos e Integrações

Este lote foca na correção de erros de tipagem (`any`, `unknown`) e conformidade com as regras de hooks em componentes visuais e de upload.

## Alterações Propostas

### 1. Dashboard e Gráficos (`src/components/app/dashboard/RealtimeHeatmap.tsx`)

- Substituir `any` por tipos explícitos para atividade em tempo real.
- Corrigir tipagem de mapas e filtros de operações.
- Garantir que o fuso horário `America/Sao_Paulo` seja aplicado consistentemente nas exibições.

### 2. Campanhas e Uploads (`src/routes/_authenticated/campanhas.tsx`)

- Definir interfaces rigorosas para o estado de upload e banners.
- Remover `any` em manipuladores de eventos de arquivo e retornos do Supabase Storage.
- Refatorar a lógica de `useEffect` para evitar dependências instáveis que violam as regras de hooks.

### 3. Funções de Backend (`src/lib/realtime.functions.ts`)

- Tipar o retorno da função `getRealtimeActivity` usando Zod ou interfaces compartilhadas.
- Assegurar isolamento de dados por `company_id` / `branch_id`.

## Verificação Técnica

- Execução de `tsgo` para validar tipos.
- Auditoria ESLint para garantir zero erros de `no-explicit-any`.
- Build de produção para validar integridade do carrossel e heatmap.
