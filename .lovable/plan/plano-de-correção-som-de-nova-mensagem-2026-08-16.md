# Plano de Correção — Som de Nova Mensagem

O objetivo é corrigir a falha no áudio ao receber mensagens normais de chat, garantindo que o som `mensagem.mp3` toque corretamente para o destinatário, independentemente do estado do chat ou da página.

## Ações a serem realizadas

### 1. Diagnóstico e Injeção de Logs Temporários
- Adicionar logs no `sendMessage` (`src/lib/chat.functions.ts`) para verificar a resolução de destinatários e o sucesso do Broadcast.
- Adicionar logs no receptor (`src/hooks/use-chat-presence.ts`) para confirmar a chegada do evento `chat:message` e a tentativa de reprodução do áudio.

### 2. Padronização do Broadcast no Servidor
- Garantir que `sendMessage` em `src/lib/chat.functions.ts` utilize o payload padrão:
  ```ts
  const payload = {
    eventId: crypto.randomUUID(),
    messageId: savedMessage.id,
    conversationId,
    fromUserId: userId,
    sentAt: savedMessage.created_at,
  }
  ```
- O evento deve ser obrigatoriamente `chat:message`.
- Resolver destinatários de forma robusta (incluindo ADMs para suporte).

### 3. Ajuste no Hook Receptor (`src/hooks/use-chat-presence.ts`)
- Unificar o registro dos listeners no canal pessoal.
- Garantir que `handleIncomingMessage` não tenha filtros impeditivos (como `isChatOpen`).
- Reutilizar o gerenciador de áudio já funcional (`messageAudioRef.current`).
- Corrigir o mapeamento do payload (Supabase entrega `{ payload: { ... } }`).

### 4. Sincronização nos Componentes de UI
- Atualizar `GlobalChatWidget.tsx` e `mensagens.tsx` para remover listeners locais duplicados ou conflitantes.
- Garantir que a lógica de "tocar som" ocorra apenas no hook centralizado.

### 5. Validação e Limpeza
- Realizar testes entre dispositivos (ADM vs Matriz).
- Verificar se o remetente não ouve o som.
- Remover logs temporários após a confirmação.

## Detalhes Técnicos
- Arquivo de áudio: `mensagem.mp3` via asset URL.
- Evento Realtime: `chat:message`.
- Canal: `local:widget:messages:${userId}` (pessoal).
