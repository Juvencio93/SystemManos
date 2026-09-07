# Plan: Adicionar Emoji de Chamada de Atenção no Bate-papo

Este plano descreve a implementação de uma funcionalidade de "Chamada de Atenção" no chat interno, permitindo que usuários enviem um alerta visual e sonoro especial.

## User Review Required

> [!IMPORTANT]
> A funcionalidade utiliza a imagem `image.png` (renomeada para `chamando-atencao.png`) e o áudio `chamando-atencao.mp3` fornecidos nos uploads. O botão será fixado ao lado do ícone de anexo no chat.

## Proposed Changes

### Database & Backend
- Atualizar a tabela `messages` para suportar o tipo `attention_emoji` (opcionalmente via coluna `metadata` ou apenas identificando pelo conteúdo especial se não houver coluna de tipo específica).
- Garantir que `sendMessage` possa lidar com o envio imediato da imagem pré-definida sem necessidade de upload pelo usuário no momento do clique.

### Frontend - Chat Widget
- Adicionar o botão "Chamada de Atenção" no campo de composição da conversa (em `GlobalChatWidget.tsx`).
- O botão usará a imagem `chamando-atencao.png` com tamanho entre 28px e 36px.
- Implementar Tooltip "Enviar chamada de atenção".
- Implementar a lógica de clique: enviar a mensagem imediatamente como um anexo fixo com metadados `attention_emoji`.

### Frontend - Audio & Notifications
- Atualizar `useChatPresence.ts` para carregar `chamando-atencao.mp3`.
- Implementar a lógica de reprodução:
    - Somente para o destinatário.
    - Respeitar o botão de silenciar.
    - Evitar duplicação por Realtime.
    - Tocar apenas uma vez por mensagem recebida.

### Visual & Mobile
- Garantir que a imagem e o botão mantenham a proporção (16:9 se aplicável, ou 1:1 original) e visibilidade em dispositivos móveis.

## Technical Details
- A imagem `chamando-atencao.png` será servida a partir de um bucket público ou via assets para garantir que o destinatário sempre tenha acesso visual.
- A reprodução do áudio será vinculada ao evento de recebimento da mensagem no `GlobalChatWidget` e `useChatPresence`.
- Prevenção de spam: embora não solicitado, uma pequena trava visual (cooldown) pode ser mantida se o usuário clicar repetidamente, para evitar poluição no histórico, mas o requisito pede envio imediato.

## Verification Plan
- **Teste de Envio:** ADM envia para Filial e verifica persistência no DB.
- **Teste Sonoro:** Filial (destinatário) deve ouvir o som ao receber; ADM (remetente) não deve.
- **Teste de Estado:** Verificar que o som não repete ao atualizar a página.
- **Teste de Mute:** Silenciar o chat e verificar que o som de atenção não toca.
- **Teste Mobile:** Verificar layout do botão no campo de texto em telas pequenas.
