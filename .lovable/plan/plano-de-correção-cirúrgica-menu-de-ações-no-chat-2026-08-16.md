# Plano de Correção Cirúrgica — Menu de Ações no Chat

Este plano visa corrigir o problema em que o menu de opções ("Fixar" e "Excluir") desaparece ou não abre ao clicar nos três pontinhos das conversas ativas no chat.

## Diagnóstico
O problema ocorre porque o botão de gatilho do menu (`DropdownMenuTrigger`) está contido dentro de um botão pai (o item da conversa), ou sofre interferência de eventos de clique e hover do pai. Além disso, o menu pode estar sendo cortado por contêineres com `overflow: hidden`.

## Ações

### 1. Refatoração Visual (Frontend)
- **Mensagens Principal (`src/routes/_authenticated/mensagens.tsx`)**:
  - Transformar o item da conversa de um `<button>` global para uma `<div>`.
  - Criar um `<button>` interno para abrir a conversa e outro para o menu.
  - Usar `DropdownMenu` com `DropdownMenuPortal` (já incluso no componente base).
  - Garantir visibilidade do ícone em mobile e no hover em desktop.
  - Impedir propagação de eventos no gatilho do menu.

- **Widget de Chat Global (`src/components/app/chat/GlobalChatWidget.tsx`)**:
  - Aplicar a mesma lógica de separação de botões e isolamento de eventos.
  - Ajustar posicionamento do menu para `side="left"` e `align="start"`.

### 2. Validação
- Verificar em runtime se o clique no menu não abre a conversa.
- Testar comportamento de hover e touch.
- Confirmar que as ações de "Fixar" e "Excluir" continuam funcionando normalmente.

## Detalhes Técnicos
- **Estrutura**:
  ```tsx
  <div className="group relative">
    <button className="flex-1" onClick={handleOpen}>Conteúdo</button>
    <DropdownMenu>
       <DropdownMenuTrigger asChild>
         <button onPointerDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
           <MoreVertical />
         </button>
       </DropdownMenuTrigger>
       {/* Menu Content */}
    </DropdownMenu>
  </div>
  ```
- **Z-Index**: O `DropdownMenuContent` usará a classe `z-[100]` para garantir que fique sobre o painel do chat.
- **Portal**: O componente `DropdownMenuContent` do projeto já utiliza `DropdownMenuPrimitive.Portal`, então o menu será renderizado fora do contêiner com scroll.
