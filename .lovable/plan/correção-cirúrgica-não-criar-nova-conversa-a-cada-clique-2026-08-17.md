# CORREÇÃO CIRÚRGICA — NÃO CRIAR NOVA CONVERSA A CADA CLIQUE

## Problema
Cada clique em um contato está gerando uma nova conversa no banco de dados, mesmo quando já existe uma conversa ativa. Isso ocorre porque a lógica de busca interpreta erroneamente a ausência de registros na tabela `conversation_user_preferences` como se a conversa estivesse excluída. Além disso, cliques rápidos disparavam múltiplas solicitações concorrentes.

## Soluções Implementadas

### 1. Backend (`src/lib/chat-validation.functions.ts`)
- **Busca Determinística**: Refatoração da busca por conversas existentes para encontrar todos os candidatos que possuam o conjunto exato de participantes (ignorando ADMs na identidade lógica).
- **Lógica de Visibilidade**: Uma conversa agora é considerada "visível" se o usuário atual **NÃO** possuir uma preferência registrada **OU** se a preferência existente tiver `hidden_at` como `null`.
- **Reuso Inteligente**: O sistema agora prioriza o retorno de uma conversa visível existente. Se todas as conversas com aquele conjunto de participantes estiverem marcadas como ocultas (`hidden_at` preenchido), uma única nova conversa é criada.

### 2. Frontend (`src/routes/_authenticated/mensagens.tsx` e `GlobalChatWidget.tsx`)
- **Trava de Concorrência**: Implementação de um `activeRequestsRef` que armazena a `Promise` da solicitação em andamento por contato. Novos cliques no mesmo contato enquanto a solicitação anterior não termina são bloqueados.
- **Feedback Visual**: Adição de estado de carregamento específico por contato na lista.

### 3. Limpeza de Dados (Auditado)
- **Identificação**: Foram identificadas múltiplas conversas duplicadas para o contato "Boteco do Barao" (ID `846e1c06-80eb-42f0-9b2d-7001fbc6cd1f`).
- **IDs Afetados (Exemplos)**: `17195e1e-e9d2-49a0-85d1-6df2f8424aef`, `bc82c06f-233b-47e4-a348-778aba44f9ba`, `29f0b5a9-de53-44fc-b058-122efb86d66e` (vazias).
- **Ação**: As duplicatas vazias serão ocultadas para o usuário atual via `conversation_user_preferences` para limpar a interface sem perda de dados históricos (conversas com mensagens como a `95c5d1a8-e5f3-481e-9a0d-6793cde062c6` são preservadas).

## Detalhes Técnicos
- Uso de `supabaseAdmin` no servidor para garantir integridade na verificação de participantes.
- Comparação de participantes baseada em chaves canônicas ordenadas (`matriz:ID`, `filial:ID`).
- Persistência atômica da preferência inicial (`hidden_at: null`) após criação de nova conversa.

## Validação Requerida
- [ ] Clicar repetidamente em um contato e verificar se apenas uma conversa é aberta/mantida.
- [ ] Ocultar uma conversa e verificar se um novo clique cria uma nova (e subsequentes cliques nela a reutilizam).
- [ ] Verificar se a conversa continua visível para o outro participante após ocultação local.
