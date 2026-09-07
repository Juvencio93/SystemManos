# Plan: Permitir conversa com contatos offline

Este plano visa garantir que o status offline de um contato não impeça a abertura de conversas ou o envio de mensagens, mantendo a experiência fluida conforme as regras de negócio.

## Modificações

### 1. Frontend: Ajustar Widget de Chat (`src/components/app/chat/GlobalChatWidget.tsx`)
- **Remover bloqueio de status:** Garantir que o clique em um contato offline no `ContactButton` abra a conversa normalmente.
- **Aviso de status offline:** Implementar um aviso discreto ("Este contato está offline...") na tela de mensagens quando o destinatário estiver offline.
- **Persistência de UI:** Garantir que o campo de entrada e o botão de envio permaneçam ativos, independente do status do contato.
- **Melhoria no `ContactButton`:** Refinar a exibição visual para que a bolinha cinza seja meramente informativa.

### 2. Backend/Funções: Garantir Fluxo de Mensagens (`src/lib/chat-validation.functions.ts` e `src/lib/chat.functions.ts`)
- **Criação de Conversas:** Completar a implementação de `getOrCreateConversation` para suportar a criação de novas conversas mesmo que o alvo esteja offline.
- **Segurança:** Validar que a abertura da conversa respeita as permissões hierárquicas (ADM > Matriz > Filial) e não o status de presença.

## Detalhes Técnicos
- O status de presença continuará sendo gerenciado pelo Supabase Realtime via o hook `useChatPresence`.
- As mensagens enviadas a contatos offline serão salvas normalmente na tabela `messages` e estarão disponíveis imediatamente para o destinatário na próxima vez que ele se conectar.
- A lógica de "Suporte" para Matrizes e Filiais será mapeada para os perfis de ADM corretos no backend.

## Validação
- Testar abertura de conversa com contato offline.
- Enviar mensagem, imagem e PDF para contato offline e verificar persistência no banco.
- Validar que o aviso de contato offline aparece apenas quando apropriado.
- Confirmar que usuários sem permissão continuam bloqueados (ex: Filial tentando ver outra Filial).
