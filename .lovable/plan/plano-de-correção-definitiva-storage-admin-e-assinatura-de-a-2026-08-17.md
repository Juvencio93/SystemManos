# Plano de Correção Definitiva - Storage Admin e Assinatura de Anexos

O objetivo é garantir a geração de URLs assinadas válidas para o bucket privado `chat_attachments`, utilizando um cliente administrativo exclusivo para storage no servidor e implementando uma validação de autorização robusta.

## Verificações Iniciais Realizadas

- **supabaseAdmin (Atual):** Configurado para remover `Authorization` se a chave for do tipo `sb_secret_`. Testes mostram que isso funciona para storage, mas a recomendação é criar um cliente isolado para evitar efeitos colaterais.
- **file_path vs storage.objects.name:** Confirmados como idênticos via script de diagnóstico.
- **Status HTTP:** Testes de runtime retornaram status `206` (Partial Content) e `200`, indicando que a URL assinada gerada pelo servidor é funcional.
- **Contrato Atual:** O frontend envia `bucket` e `path`, o que é um risco de segurança.

## Alterações Técnicas

### 1. Novo Cliente Administrativo para Storage
- Criar `src/integrations/supabase/storage.server.ts` com o cliente `supabaseStorageAdmin`.
- Este cliente não terá modificadores de headers e será exclusivo para o ambiente de servidor.

### 2. Nova Server Function de Assinatura
- Renomear `getPublicStorageUrl` para `getAttachmentSignedUrl` em `src/lib/storage.functions.ts`.
- **Validação de Autorização:**
  1. Autenticar usuário via middleware.
  2. Buscar registro do anexo em `chat_attachments`.
  3. Validar se o usuário é participante da conversa ou ADM.
  4. Utilizar `supabaseStorageAdmin` para gerar a URL.
  5. Realizar um `fetch` (HEAD ou Range 0-0) no servidor para validar a URL antes de retornar.

### 3. Refatoração do Frontend
- Atualizar `src/components/app/chat/ChatAttachment.tsx` para chamar a nova função passando apenas `attachmentId`.
- Implementar tratamento de erro com log detalhado (sem expor tokens) e estado de carregamento explícito.
- Assegurar que o botão "Tentar novamente" invalide o cache e force nova requisição.

### 4. Validação de Segurança
- Garantir que `mime_type` e `file_name` sejam persistidos corretamente no banco e usados na interface.
- Limitar a exposição de metadados do servidor.

## Plano de Ação

1.  **Backend:** Criar o cliente `supabaseStorageAdmin`.
2.  **Server Function:** Implementar `getAttachmentSignedUrl` com toda a lógica de segurança e validação runtime.
3.  **Frontend:** Atualizar `ChatAttachment.tsx` para o novo contrato.
4.  **Limpeza:** Remover/depreciar `getPublicStorageUrl` se não houver outros usos públicos críticos (avaliar `campaign-assets`).
5.  **Teste de Regressão:** Validar fluxo completo: Upload -> Banco -> Assinatura -> Renderização (Imagem/PDF) -> Retry.

## Technical Details

```text
Caminho do Anexo: chat/{conversationId}/{userId}/{uuid}-{filename}
Bucket: chat_attachments (privado)
Server Function: getAttachmentSignedUrl({ attachmentId: string })
Retorno: { signedUrl: string, mimeType: string, fileName: string }
```
