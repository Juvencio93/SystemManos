# Plano de Correção Arquitetural do Chat

O objetivo é garantir que cada conjunto de participantes possua apenas uma conversa canônica e que a exclusão seja uma preferência individual com corte de histórico, sem criar novas conversas desnecessárias.

## Alterações de Banco de Dados

1. **Nova Coluna**: Adicionar `history_cleared_at` à tabela `conversation_user_preferences`.
2. **Refatoração da RPC**: Atualizar `chat_find_or_create_conversation` para:
    - Priorizar a busca pela conversa canônica existente (mesmo que oculta).
    - Não criar duplicatas.
    - Manter a trava transacional (`pg_advisory_xact_lock`).
    - Garantir que `history_cleared_at` seja preservado ao reabrir uma conversa.

## Alterações no Backend (Server Functions)

1. **`getConversations`**:
    - Ajustar a query para filtrar mensagens baseando-se no `history_cleared_at` do usuário logado.
2. **`hideConversation`**:
    - Agora renomeado internamente ou ajustado para definir `hidden_at` E `history_cleared_at` simultaneamente ao "Excluir".
3. **`sendMessage`**:
    - Garantir que ao enviar uma mensagem, a conversa seja reexibida para os destinatários (`hidden_at = NULL`), mas o `history_cleared_at` deles permaneça intacto.

## Consolidação de Dados

- Script para agrupar conversas duplicadas pela identidade canônica.
- Mover mensagens e anexos para a conversa canônica escolhida.
- Consolidar as preferências dos usuários.
- Remover registros duplicados após validação de integridade.

## Detalhes Técnicos

### Schema
```sql
ALTER TABLE public.conversation_user_preferences ADD COLUMN history_cleared_at timestamptz NULL;
```

### Lógica de Mensagens
```sql
SELECT m.* FROM messages m
JOIN conversation_user_preferences pref ON pref.conversation_id = m.conversation_id AND pref.user_id = :userId
WHERE m.conversation_id = :convId
  AND (pref.history_cleared_at IS NULL OR m.created_at > pref.history_cleared_at)
```

## Verificação

- Teste com dois logins simultâneos simulando exclusão e reabertura.
- Verificação da persistência do histórico para quem não excluiu.
- Build, typecheck e lint para garantir integridade do código.
