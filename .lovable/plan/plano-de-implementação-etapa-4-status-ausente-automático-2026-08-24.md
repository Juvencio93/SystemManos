# Plano de Implementação - Etapa 4: Status Ausente Automático

Implementação do status **Ausente (Away)** automático após 5 minutos de inatividade, com sincronização entre abas e atualização em tempo real via Supabase Presence e Tabela de Presença.

## Alterações Técnicas

### 1. Centralização de Configuração
- Definir `AWAY_TIMEOUT = 5 * 60 * 1000` (5 minutos) em `src/hooks/use-chat-presence.ts`.

### 2. Sincronização entre Abas
- Utilizar `BroadcastChannel('chat_user_activity')` para comunicar atividade entre abas do mesmo navegador, evitando que uma aba inativa marque o usuário como ausente se outra estiver ativa.

### 3. Monitoramento de Atividade
- Implementar listeners globais (`pointerdown`, `keydown`, `touchstart`, `scroll`) em `useChatPresence`.
- Debounce/Throttle para evitar chamadas excessivas.
- Atualizar o status local e notificar outras abas via `BroadcastChannel`.

### 4. Transições de Status
- **Online -> Ausente**: Disparado após 5 minutos sem atividade local E sem sinal de atividade de outras abas. Atualiza `chat_user_presence` via server function.
- **Ausente -> Online**: Disparado imediatamente ao detectar atividade. Atualiza `chat_user_presence`.
- **Preservação de Prioridade**: O status `offline` (sem abas conectadas) continua tendo prioridade sobre o timer de ausência.

### 5. UI e Indicadores
- **ChatPresenceIndicator**: Adicionar suporte visual para o status `away` com uma bolinha amarela/âmbar (🟡) e `aria-label="Ausente"`.
- **GlobalChatWidget** & **Mensagens**: Garantir que o novo status seja exibido corretamente nas listas de contatos e cabeçalhos.

## Arquivos a serem alterados
- `src/hooks/use-chat-presence.ts`: Lógica principal de detecção, timer, BroadcastChannel e transições.
- `src/components/app/chat/ChatPresenceIndicator.tsx`: Renderização da bolinha amarela.
- `src/components/app/chat/GlobalChatWidget.tsx` & `src/routes/_authenticated/mensagens.tsx`: Pequenos ajustes se necessário para garantir a exibição do novo status (embora devam herdar do Indicator).

## Verificações
- Validar se o status muda para 🟡 após 5 minutos.
- Validar se volta para 🟢 ao mover o mouse ou digitar.
- Validar se ⚪ Offline funciona ao fechar o navegador.
- Validar se 🟢 Online se mantém se ao menos uma aba estiver ativa.
