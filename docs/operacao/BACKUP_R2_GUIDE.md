# Manual do Backup Cloudflare R2 - Manos Tech

Este documento detalha o funcionamento da rotina de backup do Supabase Storage para o Cloudflare R2 utilizando **Supabase Edge Functions**.

## 1. Arquitetura Obligatória
- **Supabase Cron:** Disparador agendado.
- **Supabase Edge Function:** `backup-storage-to-r2` (Processamento).
- **Cloudflare R2:** Destino final (Bucket: `manos-tech-backups`).

## 2. Secrets Necessários no Supabase
Os segredos abaixo devem ser cadastrados em **Settings** > **Edge Functions** no painel do Supabase. A Edge Function lerá estes valores diretamente do ambiente:

| Nome | Descrição |
| --- | --- |
| `R2_ENDPOINT` | URL do endpoint S3 do Cloudflare R2 |
| `R2_ACCESS_KEY_ID` | Chave de acesso do R2 |
| `R2_SECRET_ACCESS_KEY` | Chave secreta do R2 |
| `R2_BUCKET_NAME` | Nome do bucket R2 |
| `R2_ACCOUNT_ID` | ID da conta Cloudflare |
| `CRON_SECRET` | Token de autenticação interna (deve ser o mesmo no Vault) |
| `SUPABASE_URL` | URL do projeto (disponível por padrão) |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave de serviço (disponível por padrão) |

## 3. Implementação da Edge Function
Como o ambiente de desenvolvimento possui restrições para criação de novos arquivos em `supabase/functions/`, você deve criar a função manualmente no painel do Supabase ou via CLI:

### Comando de Deploy (CLI):
```bash
supabase functions deploy backup-storage-to-r2 --project-ref [SEU_PROJECT_ID]
```

### Código da Edge Function (`index.ts`):

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } from "https://esm.sh/@aws-sdk/client-s3@3.535.0";

const BUCKETS = ['logos', 'campaign-banners', 'marketing'];
const RETENTION_COUNT = 8;

serve(async (req) => {
  const authHeader = req.headers.get("Authorization");
  const cronSecret = Deno.env.get('CRON_SECRET');
  
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    console.error("Tentativa de backup não autorizada.");
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const R2_ENDPOINT = Deno.env.get('R2_ENDPOINT')!;
    const R2_ACCESS_KEY_ID = Deno.env.get('R2_ACCESS_KEY_ID')!;
    const R2_SECRET_ACCESS_KEY = Deno.env.get('R2_SECRET_ACCESS_KEY')!;
    const R2_BUCKET_NAME = Deno.env.get('R2_BUCKET_NAME')!;
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const s3Client = new S3Client({
      region: "auto",
      endpoint: R2_ENDPOINT,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    });

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Data em America/Sao_Paulo
    const formatter = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = formatter.formatToParts(new Date());
    const d = parts.find(p => p.type === 'day')?.value;
    const m = parts.find(p => p.type === 'month')?.value;
    const y = parts.find(p => p.type === 'year')?.value;
    const dateStr = `${y}-${m}-${d}`;
    const backupPath = `storage-backups/${dateStr}`;

    const manifest = {
      date: dateStr,
      timestamp: new Date().toISOString(),
      buckets: {},
      totalSize: 0,
      filesCount: 0,
      status: "success"
    };

    for (const bucketName of BUCKETS) {
      manifest.buckets[bucketName] = { files: [], count: 0, size: 0 };
      
      async function listRecursive(path = '') {
        const { data, error } = await supabase.storage.from(bucketName).list(path);
        if (error) throw error;
        
        for (const item of data || []) {
          const fullPath = path ? `${path}/${item.name}` : item.name;
          if (item.id === null) {
            await listRecursive(fullPath);
          } else {
            const { data: fileData, error: dlError } = await supabase.storage.from(bucketName).download(fullPath);
            if (dlError) continue;

            const buffer = await fileData.arrayBuffer();
            await s3Client.send(new PutObjectCommand({
              Bucket: R2_BUCKET_NAME,
              Key: `${backupPath}/${bucketName}/${fullPath}`,
              Body: new Uint8Array(buffer),
              ContentType: fileData.type
            }));

            manifest.buckets[bucketName].files.push(fullPath);
            manifest.buckets[bucketName].count++;
            manifest.buckets[bucketName].size += item.metadata?.size || 0;
            manifest.totalSize += item.metadata?.size || 0;
            manifest.filesCount++;
          }
        }
      }
      await listRecursive();
    }

    // Upload manifest
    await s3Client.send(new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: `${backupPath}/manifest.json`,
      Body: JSON.stringify(manifest, null, 2),
      ContentType: 'application/json'
    }));

    // Retenção
    const list = await s3Client.send(new ListObjectsV2Command({
      Bucket: R2_BUCKET_NAME,
      Prefix: 'storage-backups/',
      Delimiter: '/'
    }));

    const folders = (list.CommonPrefixes?.map(p => p.Prefix) || []).sort();
    if (folders.length > RETENTION_COUNT) {
      for (const folder of folders.slice(0, folders.length - RETENTION_COUNT)) {
        let token;
        do {
          const objs = await s3Client.send(new ListObjectsV2Command({ Bucket: R2_BUCKET_NAME, Prefix: folder, ContinuationToken: token }));
          if (objs.Contents?.length) {
            await s3Client.send(new DeleteObjectsCommand({
              Bucket: R2_BUCKET_NAME,
              Delete: { Objects: objs.Contents.map(o => ({ Key: o.Key })) }
            }));
          }
          token = objs.NextContinuationToken;
        } while (token);
      }
    }

    return new Response(JSON.stringify({ status: "success", date: dateStr }), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
```

## 4. Agendamento via Supabase Cron (SQL)
Para agendar a execução de forma segura, use o **Supabase Vault** para armazenar o `CRON_SECRET`.

### Passo a passo no Dashboard:
1. Vá em **Vault** > **Secrets**.
2. Adicione um novo segredo: **Name:** `CRON_SECRET`, **Secret:** [seu_token_aqui].
3. Utilize o SQL abaixo no Editor SQL:

```sql
-- Habilitar extensões
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Agendar (Domingos às 03:00 SP / 06:00 UTC)
SELECT cron.schedule(
    'backup-storage-r2-job',
    '0 6 * * 0',
    $$
    SELECT net.http_post(
        url := 'https://[SEU_PROJECT_REF].supabase.co/functions/v1/backup-storage-to-r2',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'CRON_SECRET')
        ),
        body := jsonb_build_object('manual', false)::text
    ) AS request_id;
    $$
);
```

## 5. Teste Manual
Acesse a aba **Test** da Edge Function no dashboard do Supabase e envie um POST com o header `Authorization: Bearer [SERVICE_ROLE_KEY]`.
Confirmar o sucesso verificando a criação da pasta `storage-backups/YYYY-MM-DD/` no bucket R2.

### Checklist de Implantação:
1.  **Edge Function:** Criar `backup-storage-to-r2` no Supabase Dashboard.
2.  **Configuração:** Em **Edge Function > Settings**, desmarcar "Verify JWT" (usamos segredo customizado).
3.  **Secrets:** Cadastrar os secrets da tabela na seção 2.
4.  **Vault:** Cadastrar `CRON_SECRET` no Supabase Vault.
5.  **SQL:** Executar o script da seção 4 para ativar o agendamento (06:00 UTC / 03:00 SP).
