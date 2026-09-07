# Plano de Padronização de Identidade do Chat por `profileId`

Padronizar todo o sistema de bate-papo (Matriz, Filial e ADM) para utilizar exclusivamente o `profileId` como identificador de participantes, contatos e presença, eliminando o uso de `companyId` para identificação direta.

## Alterações Técnicas

### 1. Servidor: Resolução de Contatos (`src/lib/chat-validation.functions.ts`)
- Atualizar `getChatContacts` para retornar o `profileId` real em todos os tipos de contato.
- Assegurar que Matriz e Filiais irmãs sejam retornadas com seus respectivos `profileId`s extraídos da tabela `user_roles`.
- Padronizar o retorno para o tipo `ChatContact` solicitado.

### 2. Servidor: Criação de Conversa (`src/lib/chat-validation.functions.ts`)
- Refatorar `getOrCreateConversation` para aceitar `recipientProfileId` (UUID) em vez de tipos discriminados baseados em empresa/unidade.
- A lógica de resolução de "quem é o destinatário" deve ser simplificada para usar o `profileId` fornecido.
- Manter a hierarquia `companyId` apenas para metadados e RLS da conversa, não para identificação de participantes.

### 3. Servidor: Lista de Conversas (`src/lib/chat.functions.ts`)
- Atualizar `getConversations` para garantir que `otherProfileId` seja extraído estritamente dos participantes da conversa.
- Garantir que `otherProfile` contenha os dados reais do perfil (displayName, role, companyId) carregados via join ou busca secundária.
- Remover fallbacks genéricos como "Contato não identificado".

### 4. Frontend: Padronização de Componentes (`GlobalChatWidget.tsx` e `mensagens.tsx`)
- Unificar a lógica de seleção de contato para usar `recipientProfileId`.
- Padronizar o uso de `presenceByProfileId.get(otherProfileId)` para exibição do status online.
- Garantir que os nomes exibidos sigam a hierarquia: ADM → "Suporte", Matriz → Nome da Empresa, Filial → Nome da Unidade.

### 5. Presença e Realtime
- Confirmar que todos os canais e eventos de broadcast utilizam `profileId`.
- Garantir que usuários do mesmo grupo empresarial (Matriz/Filiais) compartilhem canais de presença adequados.

## Validação
- Teste de fluxo completo: ADM ↔ Matriz, Matriz ↔ Filial, Filial ↔ Filial.
- Verificação de logs no console para confirmar que todos os IDs trafegados são `profileId`.
- Checagem visual da bolinha de status online em todas as interfaces.
