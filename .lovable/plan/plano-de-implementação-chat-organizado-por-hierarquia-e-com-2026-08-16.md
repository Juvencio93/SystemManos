# Plano de Implementação - Chat Organizado por Hierarquia e com Anexos

Este plano detalha a reestruturação do módulo de mensagens para suportar visibilidade hierárquica (ADM > Matriz > Filial), status de presença em tempo real aprimorado, envio de anexos (Imagens e PDF até 20MB) e correção ortográfica básica nas mensagens.

## 1. Banco de Dados e Segurança (Supabase)

### 1.1. Alterações no Schema
- Criar a tabela `chat_attachments` para registrar os metadados dos arquivos enviados.
- Criar o bucket `chat_attachments` no Supabase Storage.
- Adicionar suporte a `parent_conversation_id` em `conversations` (opcional, para agrupamento, mas usaremos lógica de participantes para hierarquia).

### 1.2. Segurança (RLS e SECURITY DEFINER)
- Atualizar as funções `SECURITY DEFINER` para validar a hierarquia:
    - **ADM**: Acesso total a todas as conversas das empresas vinculadas.
    - **Matriz**: Acesso a conversas com suas Filiais e com o Suporte (ADM).
    - **Filial**: Acesso a conversas com sua Matriz e com o Suporte (ADM).
- Garantir que as políticas de RLS no bucket de Storage sigam as mesmas regras.

## 2. Lógica de Servidor (Server Functions)

### 2.1. Hierarquia de Contatos (`get_chat_contacts`)
- Nova server function para buscar contatos organizados:
    - ADM recebe lista de Matrizes (agrupadores) e Filiais vinculadas.
    - Matriz recebe lista de Filiais e o Suporte.
    - Filial recebe sua Matriz e o Suporte.

### 2.2. Envio de Anexos (`upload_chat_attachment`)
- Server function para validar permissões antes de gerar o link de upload/processar o arquivo.
- Validação rigorosa de MIME type (image/*, application/pdf) e tamanho (20MB).

### 2.3. Processamento de Texto
- Implementar lógica na server function `sendMessage` para garantir:
    - Início com letra maiúscula.
    - Correção ortográfica básica (usando bibliotecas leves ou lógica interna sem alterar siglas/marcas).

## 3. Frontend e UI (React)

### 3.1. Reestruturação da Sidebar de Mensagens
- Implementar grupos expansíveis (Accordion) para Matrizes no perfil ADM.
- Adicionar indicadores de status (bolinha verde/cinza) baseados no Singleton de presença `useChatPresence`.
- Fallback de nome: Priorizar "Como gostaria de ser chamado" (trade_name) sobre o nome empresarial.

### 3.2. Interface de Chat Aprimorada
- Balões de mensagem com quebra automática de linha (`word-break: break-word`).
- Componente de visualização de anexos (Preview de imagem, ícone para PDF).
- Barra de progresso de upload e tratamento de erros visuais para limites de tamanho/tipo.

### 3.3. Melhorias de UX
- Sons de notificação (já existentes, validar integração).
- Responsividade mobile (Recolher grupos, adaptação de anexos).

## Detalhes Técnicos

### Schema SQL
```sql
CREATE TABLE public.chat_attachments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id uuid REFERENCES public.messages(id) ON DELETE CASCADE,
    file_path text NOT NULL,
    file_name text NOT NULL,
    file_size bigint NOT NULL,
    mime_type text NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- Grants e RLS conforme política de mensagens
```

### Validações de Arquivo
- **Limites**: 20 * 1024 * 1024 bytes.
- **Tipos**: `image/jpeg`, `image/png`, `image/webp`, `application/pdf`.

### Presença
- Utilizar o Singleton `activeChannels` em `use-chat-presence.ts` para garantir que o status seja refletido em tempo real na lista de contatos sem duplicar conexões.
