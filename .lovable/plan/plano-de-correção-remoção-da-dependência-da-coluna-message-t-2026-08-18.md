# Plano de Correção: Remoção da Dependência da Coluna `message_type`

O runtime e a inspeção do schema confirmaram que a coluna `message_type` não existe na tabela `public.messages`. Este plano descreve as alterações necessárias para remover todas as referências a essa coluna, utilizando a coluna `event` como discriminador para mensagens de "chamada de atenção" (attention/nudge), e garantindo a estabilidade da UI e do fluxo de mensagens.

## Alterações Técnicas

### Backend e Funções de Servidor

1.  **`src/lib/chat.functions.ts`**:
    *   Remover `message_type` do seletor SQL na função `getConversations`.
    *   Remover `message_type` do `.insert()` na função `sendMessage`.
    *   Remover `message_type` da validação Zod no `sendMessage`.
    *   Remover `message_type` da verificação de idempotência.
    *   Ajustar o normalizador de mensagens para identificar o tipo `attention` através do campo `event === 'nudge'`.

2.  **`src/lib/chat-attention.functions.ts`**:
    *   Garantir que a chamada para `sendMessage` não inclua `messageType`.
    *   Manter `event: 'nudge'` e `content: '🥺'`.

### Frontend e Componentes UI

1.  **`src/components/app/chat/GlobalChatWidget.tsx`** e **`src/routes/_authenticated/mensagens.tsx`**:
    *   Remover referências a `message_type` ou `messageType` nos componentes e hooks.
    *   Ajustar a lógica de renderização para usar `message.event === 'nudge'` para identificar chamadas de atenção.
    *   Envolver as chamadas de `callContactAttention` em blocos `try/catch` robustos para evitar telas brancas (ErrorBoundaries), exibindo `toast.error` em caso de falha.
    *   Garantir que efeitos sonoros e visuais (tremor) ocorram apenas após o sucesso da persistência.
    *   Certificar que o emoji `🥺` seja renderizado como texto Unicode em um balão compacto, sem ícones de imagem quebrados.

### Tipagem

1.  **Interfaces Globais**:
    *   Remover `message_type` das interfaces `Message` definidas localmente nos componentes.

## Verificação e Prova de Conceito

*   **Id do Mensagem Real**: Validar se um UUID real é gerado.
*   **Conteúdo**: Confirmar que o conteúdo é exatamente `🥺`.
*   **Ausência de `message_type`**: Verificar nos logs do console e de rede que nenhum payload enviado ao Supabase contém a chave `message_type`.
*   **Attachment Null**: Garantir que `attachment_url` (ou correspondente) não seja enviado/processado para nudges.
*   **Recibo**: Validar a criação de registros na tabela `chat_message_receipts`.
*   **Estabilidade**: O chat deve permanecer funcional e aberto mesmo após erros simulados na função de servidor.
