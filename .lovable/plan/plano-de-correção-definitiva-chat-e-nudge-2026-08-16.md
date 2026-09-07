# Plano de Correção Definitiva — Chat e Nudge

Este plano visa corrigir os problemas de vínculo entre contatos e conversas, falhas na criação de novas conversas (erro ON CONFLICT) e o fluxo incompleto da chamada de atenção (Nudge).

## Problemas Identificados
1.  **Vínculo Incorreto**: Contatos com conversas ativas (ex: Panificadora) não estão sendo associados corretamente, resultando em erros ou tentativas de duplicar conversas.
2.  **Erro de Constraint**: A tentativa de criar conversas novas (ex: Solver Matriz) falha com erro de "ON CONFLICT" devido ao uso de especificações de conflito que não existem no banco.
3.  **Nudge Unilateral**: A chamada de atenção funciona apenas para quem envia; o destinatário não recebe o feedback visual/sonoro completo.
4.  **UUID Inválido**: Ocorrência de erros de sintaxe de UUID em mutações de mensagens.
5.  **Branding na Lista**: Conversas ativas exibindo IDs genéricos (#b645) em vez do nome da empresa/unidade.

## Escopo das Alterações

### Backend (`src/lib/chat.functions.ts` e `src/lib/chat-validation.functions.ts`)
- **Identidade Canônica**: Implementar `participantKey` para resolver participantes por prefixo (`matriz:ID`, `filial:ID`).
- **Busca Determinística**: Refatorar `getOrCreateConversation` para buscar conversas por conjunto exato de participantes antes de tentar qualquer inserção.
- **Remoção de Upsert Inválido**: Substituir `.upsert` com `onConflict` por um `.insert` atômico após validação prévia.
- **Validação de UUID**: Garantir que o `inputValidator` de `sendMessage` exija UUIDs válidos.

### Frontend (`src/components/app/chat/GlobalChatWidget.tsx` e `src/routes/_authenticated/mensagens.tsx`)
- **Fluxo de Clique**: Remover envios automáticos de mensagens ao clicar no contato. O clique apenas abre ou cria a conversa.
- **Nudge Broadcast**: Refatorar o recebimento do Nudge para que o destinatário abra o widget, selecione a conversa correta, toque o som especial e execute o tremor (shake).
- **Visualização**: Implementar `abbreviateName` e lógica de exibição de nomes na lista de conversas ativas, priorizando nomes de empresas/unidades.
- **Segurança de ID**: Bloquear qualquer chamada de mutação se o `conversationId` não for um UUID válido (usando `isValidUuid`).

## Detalhes Técnicos
- Uso de `supabaseAdmin` no servidor para resolver identidades de forma confiável.
- Filtragem de participantes ADM em conversas antigas para manter compatibilidade com o histórico.
- Sincronização de sons e efeitos via Supabase Broadcast com controle de duplicidade por `eventId`.

## Restrições
- Não alterar `Presence` (status online).
- Não alterar banco de dados, migrations ou RLS.
- Não alterar lógica de hierarquia ou permissões.

---
**Observação**: O diagnóstico completo dos trechos de código atuais será apresentado conforme solicitado antes da aplicação final das correções.