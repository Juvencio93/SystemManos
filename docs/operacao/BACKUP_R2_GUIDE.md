# Backup do Supabase Storage para Cloudflare R2

Revisão: 12 de outubro de 2026.

## Função versionada

A função está em `supabase/functions/backup-storage-to-r2/index.ts`. A versão local cobre os cinco buckets existentes: `logos`, `campaign-assets`, `brand-assets`, `chat_attachments` e `chat-avatars`.

Ela:

- autentica chamadas pelo `CRON_SECRET` (a verificação JWT permanece desativada por esse motivo);
- copia os objetos com concorrência limitada;
- respeita intervalo mínimo de 14 dias para não ultrapassar o egress do Supabase Free no volume atual;
- confere o tamanho de cada objeto enviado ao R2;
- grava em `storage-backups/YYYY-MM-DD/manifest.json` bucket, caminho, tipo, tamanho e SHA-256;
- mantém oito versões no índice `storage-backups/index.json` e registra a última execução em `storage-backups/last-run.json`.

Cada cópia usa aproximadamente 213 MiB no volume medido. Com uma execução a cada 14 dias, a transferência estimada fica em cerca de 426 MiB por mês, fora outros usos do projeto.

## Segredos exigidos pela função

Configurar em **Supabase Dashboard → Edge Functions → Secrets**: `R2_ACCOUNT_ID`, `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME` e `CRON_SECRET`. A plataforma injeta `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`.

O mesmo `CRON_SECRET` deve existir no Supabase Vault para a chamada agendada já configurada. Nunca coloque esses valores no código ou em migrações.

## Publicação e verificação

A versão 9 foi publicada no projeto Supabase em 12 de outubro de 2026, mantendo `verify_jwt=false` e autenticação pelo `CRON_SECRET`. Ainda não foi executada uma cópia manual. Na próxima execução autorizada, confira:

1. resposta da função com `status: success`;
2. manifesto com os cinco buckets e contagens;
3. tamanho e SHA-256 de cada objeto;
4. `storage-backups/last-run.json` no R2;
5. histórico de execução do cron.

A função ignora chamadas antes de completar 14 dias desde a última cópia. O cron ativo chama semanalmente aos domingos às 06:00 UTC. O status `succeeded` no `pg_cron` não comprova que a cópia remota terminou; confirme o manifesto e `last-run.json`.

## Retenção do dump do banco no R2

O workflow manual grava em `database-backups/` e verifica tamanho e SHA-256 após baixar o objeto do R2. O agendamento diário deve ser ativado somente depois de cadastrar os secrets e variables exigidos. Configure no painel Cloudflare uma regra de lifecycle com prefixo exatamente `database-backups/` e expiração após 35 dias. O R2 aplica regras por prefixo; não use prefixo vazio porque isso também apagaria os backups do Storage. [Ciclo de vida de objetos R2](https://developers.cloudflare.com/r2/buckets/object-lifecycles/)

O R2 Standard tem atualmente 10 GB-month de armazenamento e cotas de operações incluídas; o consumo é compartilhado com outros objetos da conta. O volume estimado atual cabe nessa cota, mas dumps e mídia crescerão. [Preços R2](https://developers.cloudflare.com/r2/pricing/)

## Recuperação dos objetos

A rotina versionada `scripts/restore-storage-from-r2.mjs` lê o manifesto de uma data, cria buckets ausentes com a configuração registrada, baixa os objetos, valida tamanho e SHA-256 e envia para o projeto Supabase informado. Rode somente contra um projeto de restauração isolado, usando as variáveis de ambiente do alvo. Ela usa `upsert` e não apaga objetos extras do destino.

```bash
R2_ACCOUNT_ID=... R2_BUCKET_NAME=... R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... \
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
node scripts/restore-storage-from-r2.mjs 2026-10-12
```

No Windows PowerShell, defina as mesmas variáveis com `$env:NOME="valor"` antes do comando. Não salve os valores em arquivos versionados.

O primeiro backup com o novo manifesto precisa terminar antes de a restauração completa de todos os buckets estar disponível. Backups antigos sem `bucketConfigs` podem exigir que os buckets sejam criados manualmente no projeto de destino.
