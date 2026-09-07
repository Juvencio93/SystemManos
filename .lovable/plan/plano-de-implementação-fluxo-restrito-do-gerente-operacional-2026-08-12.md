# Plano de Implementação: Fluxo Restrito do Gerente Operacional IA para Matriz

Este plano visa corrigir e otimizar o fluxo do Gerente Operacional para usuários do tipo **Matriz**, removendo o carregamento automático no Dashboard, implementando geração sob demanda na página dedicada e garantindo o isolamento total de dados.

## Alterações Propostas

### 1. Frontend: Dashboard da Matriz (`src/components/app/ai-agent-card.tsx`)

- **Remover consulta automática:** Desativar a chamada à função `getLatestOperationalAnalysis` quando o papel do usuário for `matriz`.
- **Simplificação Visual:** Remover o bloco "Resumo Diário Operacional" que carregava automaticamente.
- **Card Compacto:** Substituir o visual atual por um card/botão compacto que convida o usuário a abrir a análise, navegando para `/gerente-operacional`.

### 2. Página do Gerente Operacional (`src/routes/_authenticated/gerente-operacional.tsx`)

- **Segurança no Servidor:** A página já utiliza `beforeLoad` para capturar o `role` e `companyId` do token de autenticação.
- **Configuração da Consulta:** Ajustar `useQuery` para desativar `refetchOnWindowFocus` e `refetchOnReconnect`.
- **Interface da Matriz:** Adaptar a UI para exibir apenas a própria Matriz e suas filiais, removendo elementos administrativos (UUIDs, botões globais).

### 3. Lógica de Análise (`src/lib/operational.functions.ts`)

- **Geração sob Demanda:** Criar uma lógica na Server Function `getLatestOperationalAnalysis` (ou similar) que:
  - Verifique se já existe uma análise válida para o dia atual no fuso `America/Sao_Paulo`.
  - Calcule um hash dos dados operacionais atuais (conexões, campanhas, etc.).
  - Só gere uma nova análise via IA se: (a) for a primeira do dia ou (b) o hash mudou E o cooldown de 60 minutos expirou.
- **Resolução de Identidade:** Garantir que o `company_id` seja obtido via middleware/contexto do servidor, nunca via input do cliente.

### 4. Integração com IA e Grounding (`src/lib/ai.server.ts` & `src/lib/operational-job.server.ts`)

- **Dados de Contexto:** Incluir "Perfil Comercial" (segmento, descrição, objetivo) na análise da Matriz.
- **Grounding (Pesquisa Externa):**
  - Auditar `src/lib/ai.server.ts` para verificar suporte nativo a pesquisa (o provedor atual é DeepSeek).
  - Se disponível, incluir tendências e benchmarks do segmento sem expor dados sensíveis (CNPJ, e-mail, etc.).
  - Caso contrário, fornecer orientações gerais baseadas no conhecimento da IA.

## Detalhes Técnicos

- **Fuso Horário:** `America/Sao_Paulo` para controle de cache diário.
- **Hierarquia:** Matriz sempre no topo, seguida pelas filiais.
- **Formatos:** Resposta da IA validada como JSON estruturado antes de persistir.
- **Restrição:** Nenhuma alteração no Dashboard do ADM, na visão de Filial ou em outros módulos do sistema.

## Validação

- Testar login ADM para garantir que a visão global permanece intacta.
- Testar login Matriz para verificar:
  - Dashboard limpo e rápido.
  - Navegação para página de análise.
  - Análise isolada (apenas seus dados).
  - Persistência/Cache (IA não é chamada repetidamente).
- Executar `npm run build` e `npx tsc --noEmit`.
