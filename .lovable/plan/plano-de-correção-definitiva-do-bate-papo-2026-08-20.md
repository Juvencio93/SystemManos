# Plano de Correção Definitiva do Bate-papo

Este plano implementa a transição completa para identidades baseadas em `profileId` e padroniza a resolução de contatos conforme a hierarquia de empresas da Manos Tech.

## Alterações Técnicas

### 1. Refatoração do Backend (Server Functions)
- **`src/lib/chat-validation.functions.ts`**:
    - Renomear/Refatorar `getChatContacts` para `resolveChatContacts`.
    - Garantir que a resolução de **Matriz** e **Filiais irmãs** retorne sempre `profileId`, `companyId`, `displayName` (Nome Fantasia) e `role`.
    - Remover placeholders ("Contato", "UNIDADE").
    - Implementar validação estrita no retorno: nenhum contato sem os campos obrigatórios.
    - Refatorar `getOrCreateConversation` para validar que `recipientProfileId` é um UUID de perfil real.
    - Refatorar `resolveNudgeTargetUserIds` para usar apenas IDs de perfil.
- **`src/lib/chat.functions.ts`**:
    - Refatorar `getConversations` para enriquecer conversas usando a lógica canônica de nomes (Trade Name para empresas, "Suporte" para ADM).
    - Garantir que `other_profile_id` seja o identificador único para renderização de avatares e nomes.
    - Remover fallbacks genéricos de nomes na listagem.
- **`src/lib/chat-attention.functions.ts`**:
    - Atualizar `callContactAttention` para aceitar `recipientProfileId` e garantir que o broadcast de nudge use esse ID.

### 2. Refatoração do Frontend (Componentes e Hooks)
- **`src/components/app/chat/GlobalChatWidget.tsx`** & **`src/routes/_authenticated/mensagens.tsx`**:
    - Substituir chamadas de `getChatContacts` pelo novo resolvedor.
    - Unificar a lógica de Presence: usar `contact.profileId` como chave em `onlineUsers` ou `onlinePresences`.
    - Remover filtros manuais de "identidade inválida" no componente, delegando a integridade ao backend.
    - Garantir que a bolinha de status online reflita o `profileId` real.
- **`src/hooks/use-chat-presence.ts`**:
    - Confirmar que o rastreamento (`track`) e broadcast de presença usam `userId` (profileId) como chave primária.
    - Garantir que todos os usuários (Matriz e Filial) entrem no canal `presence:global` para visibilidade mútua.

## Regras de Negócio e Hierarquia
- **Login Matriz**: Vê ADM ("Suporte") e todas as Filiais da mesma empresa. Não vê a si mesma.
- **Login Filial**: Vê ADM ("Suporte"), sua Matriz (mesma empresa, role matriz) e Filiais irmãs (mesma empresa, outras filiais). Não vê a si mesma.
- **Identidade Visual**: ADM = "Suporte". Unidades = Trade Name (Nome Fantasia).

## Validação e Testes
- **Build & Typecheck**: `npm run build` e `tsgo`.
- **Diagnóstico Manual**: Rodar script de verificação de hierarquia para confirmar que Matriz e Filiais têm perfis vinculados antes de exibir.
- **Teste de Fluxo**: Simular envio de mensagem da Matriz para Filial e verificar se o nome exibido é o Nome Fantasia da Matriz e não um ID ou placeholder.
