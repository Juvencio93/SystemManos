# Restauração do Supabase — teste em ambiente isolado

Use um projeto Supabase separado. Nunca aponte este procedimento para o projeto de produção durante um ensaio.

## Banco de dados

1. Baixe `database.tar.gz.age` e `manifest.json` do prefixo `database-backups/YYYY-MM-DD/ID/` no bucket R2.
2. Compare o SHA-256 do arquivo com `manifest.json`.
3. Descriptografe usando a identidade privada `age` guardada fora do GitHub e do R2:

```bash
age --decrypt --identity /caminho/seguro/age-identity.txt \
  --output database.tar.gz database.tar.gz.age
tar -xzf database.tar.gz
```

4. Use `psql` e a connection string do projeto isolado. A CLI oficial documenta o formato dos três dumps e a restauração com `ON_ERROR_STOP`:

```bash
psql \
  --single-transaction \
  --variable ON_ERROR_STOP=1 \
  --file roles.sql \
  --file schema.sql \
  --command 'SET session_replication_role = replica' \
  --file data.sql \
  --dbname "$RESTORE_DB_URL"
```

Se o destino Supabase rejeitar a criação de roles reservadas, pare e siga as instruções de restauração da versão atual da documentação oficial; não remova comandos do dump às cegas. [Guia Supabase CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)

## Arquivos do Storage

Defina `R2_ACCOUNT_ID`, `R2_BUCKET_NAME`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` com valores do bucket e do projeto isolado. Rode:

```bash
node scripts/restore-storage-from-r2.mjs YYYY-MM-DD
```

O script verifica o tamanho e SHA-256 antes do upload, cria buckets ausentes usando a configuração guardada no manifesto e não remove arquivos extras do destino. Use apenas manifesto produzido pela função versionada; manifestos anteriores podem não conter configuração de buckets.

## Verificações depois da restauração

- Conferir tabelas, dados principais, extensões e políticas RLS.
- Validar autenticação com usuário de teste e isolamento entre empresas.
- Conferir leitura de logos, anexos, banners e arquivos do portal.
- Manter cobrança, Telegram, webhooks e outras integrações externas desativadas no projeto isolado.
- Anotar início, término, cópia usada, erros e resultado. O RTO só pode ser definido após esse ensaio.
