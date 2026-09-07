# Plan: CORREÇÃO CIRÚRGICA — NÃO CRIAR NOVA CONVERSA A CADA CLIQUE

Implementar a regra definitiva de reutilização de conversas, garantindo que a exclusão (ocultação) seja uma preferência individual e que conversas existentes sejam reaproveitadas corretamente, evitando a criação de duplicatas.

## User Review Required

> [!IMPORTANT]
> A causa raiz identificada é que a busca por conversas existentes em `getOrCreateConversation` utiliza `!hiddenAt` (de `conversation_user_preferences`), o que falha quando a preferência ainda não existe para o usuário (tratando erroneamente como conversa excluída).

## Proposed Changes

### 1. Servidor: Ajuste em `getOrCreateConversation` (`src/lib/chat-validation.functions.ts`)
- **Nova Lógica de Busca**:
    - Buscar todas as conversas da empresa com os participantes exatos.
    - Buscar as preferências do usuário atual para essas conversas.
    - **Regra de Visibilidade**: Uma conversa é visível se:
        - Não existir linha em `conversation_user_preferences`.
        - OU existir linha com `hidden_at === null`.
    - **Regra de Reuso**: Se encontrar uma conversa visível, abrir e não inserir nada.
- **Nova Lógica de Criação**:
    - Somente se NÃO houver conversa visível, criar uma nova.
    - Garantir inserção atômica de participantes e da preferência inicial (`hidden_at: null`).

### 2. Frontend: Proteção contra Duplo Clique (`src/routes/_authenticated/mensagens.tsx` & `GlobalChatWidget.tsx`)
- Implementar `loadingStates` mapeado por `targetKey` (`type:id`).
- Bloquear novos cliques enquanto uma Promise de `getOrCreateConversation` estiver em andamento para aquele contato específico.
- Reutilizar a mesma Promise se o usuário clicar repetidamente no mesmo contato antes da resolução.

### 3. Limpeza de Duplicatas (Ocultação Individual)
- Manter conversas com mensagens.
- Para duplicatas vazias de "Boteco do Barão" (e outros), aplicar `hidden_at` apenas para o usuário atual.

## Technical Details

- **Atomicidade**: Utilizar o `supabaseAdmin` em `getOrCreateConversation` para garantir que a verificação e criação ocorram sem interferência de RLS durante o handshake inicial.
- **Participantes**: A identidade lógica continuará ignorando usuários com papel `adm` para facilitar o contato direto entre unidades e suporte.
- **Timeline**: A busca priorizará a conversa visível mais recente caso o bug tenha gerado múltiplas visíveis (improvável após a correção, mas seguro para o legado).

## Verification Plan

### Automated Tests
- Simular 10 cliques rápidos no mesmo contato e verificar se apenas uma chamada de rede é feita e apenas um ID é retornado.
- Validar via script que a ausência de registro em `conversation_user_preferences` não impede o reuso da conversa.

### Manual Verification
1. Clicar 10 vezes em "Boteco do Barão" -> Confirmar mesmo ID.
2. Excluir (Ocultar) a conversa no login Matriz.
3. Confirmar que a conversa permanece visível no login Suporte (ADM).
4. No login Matriz, clicar novamente -> Confirmar criação de UMA nova conversa.
5. Clicar novamente 10 vezes -> Confirmar reuso da nova.
