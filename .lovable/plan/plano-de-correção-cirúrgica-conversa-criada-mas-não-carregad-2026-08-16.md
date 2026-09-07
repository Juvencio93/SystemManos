# Plano de Correção Cirúrgica — Conversa Criada, mas não Carregada

O problema ocorre porque o frontend tenta abrir uma conversa imediatamente após sua criação (ou recuperação) no servidor, mas falha ao sincronizar o estado local com os dados atualizados. Além disso, há uma discrepância de contrato entre o servidor (que retorna `{ id, created }`) e o frontend (que espera `conversationId`).

## Alterações Propostas

### 1. Servidor (`src/lib/chat-validation.functions.ts`)
- Ajustar o contrato de retorno da função `getOrCreateConversation` para retornar explicitamente `conversationId` em vez de `id`, conforme exigido pelo plano cirúrgico.
- Adicionar validação robusta do `conversationId` antes do retorno.

### 2. Frontend (`src/components/app/chat/GlobalChatWidget.tsx`)
- Refatorar a função `selectContact` para:
    - Utilizar o retorno correto da `getOrCreateConversation` (`conversationId`).
    - Obter o resultado atualizado diretamente do `refetchConversations()`.
    - Buscar a conversa no array retornado pelo refetch, e não no estado antigo do componente.
    - Adicionar logs temporários de depuração para rastreamento em runtime.
- Substituir o erro genérico por validações específicas.

## Detalhes Técnicos

### Contrato de Dados
```typescript
type ConversationResult = {
  conversationId: string;
  created: boolean;
};
```

### Lógica de Sincronização
1. Chamar `getOrCreateConversation`.
2. Validar a existência de `conversationId`.
3. Executar `await refetchConversations()`.
4. Localizar a conversa no `data` retornado pelo refetch.
5. Definir os estados `activeConversationId` e `setSelectedConversation`.

## Validação
- **Build & Typecheck**: `bun run build` e `bunx tsc --noEmit`.
- **Testes Manuais**:
    - ADM → Matriz (Boteco do Barão).
    - ADM → Filial (Panificadora).
    - Matriz → Suporte.
    - Teste de conversa já existente (não deve criar duplicata).
    - Teste de clique duplo rápido.
