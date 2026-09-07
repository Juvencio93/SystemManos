# Plano de Correção Definitiva - Conversas Duplicadas

Implementação de idempotência atômica no servidor e trava de concorrência global no frontend para eliminar a criação de conversas duplicadas no chat.

## Alterações Técnicas

### 1. Banco de Dados (PostgreSQL)
- Criar a função RPC `chat_find_or_create_conversation` com `SECURITY INVOKER`.
- Implementar trava transacional `pg_advisory_xact_lock` baseada na chave canônica dos participantes.
- Garantir que a busca por conversas existentes ocorra **dentro** da transação, após a trava.
- Configurar permissões restritas: `REVOKE ALL` para `PUBLIC` e `GRANT EXECUTE` apenas para `service_role`.

### 2. Frontend (React)
- **Trava Global:** Utilizar `src/lib/chat-conversation-request-lock.ts` para centralizar o mapa de promessas pendentes, impedindo que cliques rápidos ou componentes diferentes disparem a mesma requisição.
- **Contrato Canônico:** Implementar o tipo `ChatTarget` (`support`, `matriz`, `filial`) e a função `participantIdentity` para gerar chaves determinísticas.
- **Integração:** Atualizar `GlobalChatWidget.tsx` e `mensagens.tsx` para usar o novo contrato e a trava compartilhada.

### 3. Backend (TanStack Start)
- Refatorar a Server Function `getOrCreateConversation` para:
  1. Validar hierarquia e permissões.
  2. Resolver o `ChatTarget` canônico.
  3. Gerar a identidade dos participantes ordenada.
  4. Chamar a RPC segura via `supabaseAdmin`.
- Respeitar a regra de visibilidade: reaproveitar conversas onde `hidden_at` é nulo; criar nova se todas estiverem ocultas para o usuário.

## Validação e Testes
- **Audit Pré-Implementação:** 26 conversas identificadas.
- **Testes de Estresse:**
  - 10 cliques rápidos simultâneos no widget e na rota de mensagens.
  - Acesso simultâneo via múltiplas abas e dispositivos (PC/Celular).
  - Matriz de testes de papéis: ADM, Matriz, Filial e Suporte em todas as combinações permitidas.
- **Critério de Aceite:** Nenhuma conversa duplicada gerada; todas as chamadas retornando o mesmo ID; build, typecheck e lint sem erros.
