# Plano de Implementação - Etapa 5: Status Ocupado Manual e Seletor de Presença

Implementação do status **Ocupado (Busy)** manual, um seletor de status para o próprio usuário e lógica de prioridade entre estados automáticos e manuais.

## Alterações Técnicas

### 1. Extensão do Hook de Presença (`src/hooks/use-chat-presence.ts`)
- Adicionar estado `manualStatus` persistido no `localStorage` e sincronizado via `BroadcastChannel`.
- **Regra de Prioridade**:
    1. Se `manualStatus === 'busy'`, ignorar inatividade e manter status `busy`.
    2. Se `manualStatus === 'away'`, ignorar atividade e manter status `away`.
    3. Se `manualStatus === 'online'` ou `null`, seguir lógica automática (Online <-> Away após 5 min).
- Garantir que ao voltar para `online` manualmente, o timer de inatividade seja reiniciado.

### 2. Componente de Seletor (`src/components/app/chat/ChatStatusSelector.tsx`)
- Criar um novo componente compacto (DropdownMenu) com as opções: 🟢 Online, 🟡 Ausente, 🔴 Ocupado.
- Este seletor chamará uma nova função no hook `useChatPresence` para atualizar o `manualStatus`.

### 3. UI Indicador (`src/components/app/chat/ChatPresenceIndicator.tsx`)
- Adicionar suporte visual para `busy` (🔴 bolinha vermelha) com `aria-label="Ocupado"`.

### 4. Integração na Interface
- **GlobalChatWidget**: Adicionar o `ChatStatusSelector` no cabeçalho ou próximo ao avatar do próprio usuário no painel de chat.
- **Página Mensagens**: Adicionar o `ChatStatusSelector` na área do perfil do usuário logado.

### 5. Sincronização e Persistência
- O `manualStatus` deve ser salvo no `localStorage` para persistir entre recarregamentos.
- Ao mudar em uma aba, notificar outras abas via `BroadcastChannel('chat_user_activity')` com uma mensagem específica (ex: `STATUS_CHANGE`).

## Arquivos a serem alterados
- `src/hooks/use-chat-presence.ts`: Lógica de prioridade, persistência e sincronização.
- `src/components/app/chat/ChatPresenceIndicator.tsx`: Suporte visual para status `busy`.
- `src/components/app/chat/ChatStatusSelector.tsx`: Novo componente de seletor.
- `src/components/app/chat/GlobalChatWidget.tsx`: Inserção do seletor.
- `src/routes/_authenticated/mensagens.tsx`: Inserção do seletor.

## Verificações (Testes)
- Mudar para 🔴 Ocupado e esperar 5 min (deve continuar 🔴).
- Mudar de 🔴 Ocupado para 🟢 Online (deve atualizar em tempo real e em outras abas).
- Mudar para 🟡 Ausente manualmente e interagir (deve continuar 🟡 até mudar manual).
- Validar se ⚪ Offline continua funcionando ao fechar abas.
