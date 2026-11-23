# Bucket `logos` — origem, identificação e limpeza (Frente 10)

## O que é o bucket `logos`

- **Origem identificada nas migrations:** o `logos` era o bucket de logos
  ORIGINAL do sistema (agosto/2026), com as pastas `plataforma/` (logo
  da plataforma, só ADM), `empresas/<uuid-da-empresa>/` (logos de
  empresa) e `filiais/<uuid-da-filial>/` (logos de filial).
  - `supabase/migrations/20260811055443_b7fd4064-482f-4bad-8815-adea06dd3e26.sql`
    — "Policies para o bucket logos" (leitura pública + uploads por pasta).
  - `supabase/migrations/20260811075438_8547c6e7-d62f-49d2-98a6-56dd6a693adf.sql`
    — recria as policies "Logos Select/Insert/Update/Delete".
  - `supabase/migrations/20260811133456_a5808f0a-cd54-44a0-a33e-220a3e9cb196.sql`
    — "Bucket ID: 'logos'".
  - `supabase/migrations/20260904012314_secure_private_storage_policies.sql`
    (linha ~305) — seção "legacy logos bucket", que substitui as policies
    antigas pelas "Scoped logos select/insert/update/delete" (acesso por
    pasta: `plataforma` só ADM, `empresas`/`filiais` por UUID).
- **Substituído em 27/08/2026:** a logo da plataforma mudou para o bucket
  `brand-assets` (`20260827030000_create_brand_assets_bucket.sql`) e as
  logos de empresa/filial para o `campaign-assets`
  (`users/<uid>/company-logos/` e `users/<uid>/branch-logos/`).
- **A criação do bucket em si NÃO está em nenhuma migration** — foi feita
  no Dashboard do Supabase (as migrations só versionam as policies).
- **Código atual:** NENHUM arquivo em `src/` referencia o bucket `logos`
  (zero `.from('logos')`). O `logos/<uid>/` que aparece em
  `configuracoes.tsx` e `storage.functions.ts` é uma PASTA dentro do
  bucket `brand-assets` — não o bucket `logos`.
- **Estado conhecido (censo de 23/11/2026):** 10 arquivos, ~1,8 MB.
  O conteúdo dos arquivos NÃO foi inspecionado aqui — a identificação
  é o passo abaixo, no SQL Editor.

## Identificar os arquivos (SQL Editor do Supabase)

Rodar na ordem. As queries 3 e 4 decidem se algum arquivo ainda está
em uso — **não apagar nada antes delas**.

### 1. Configuração do bucket

```sql
SELECT id, name, public, file_size_limit, allowed_mime_types, created_at
FROM storage.buckets
WHERE id = 'logos';
```

### 2. Listar os 10 arquivos (nome, tamanho, tipo, datas)

```sql
SELECT name,
       (metadata ->> 'size')::bigint AS size_bytes,
       metadata ->> 'mimetype' AS mime,
       created_at,
       updated_at
FROM storage.objects
WHERE bucket_id = 'logos'
ORDER BY name;
```

### 3. Algum valor no banco ainda aponta para o bucket `logos`?

O padrão casa a URL pública (`/object/public/logos/...`) e a assinada
(`/object/sign/logos/...`). **Não usar `%/logos/%` sozinho:** ele também
casaria a pasta `logos/<uid>/` dentro do bucket `brand-assets` (logo da
plataforma) e daria falso positivo.

```sql
SELECT 'companies.logo_url' AS fonte, id::text AS registro, logo_url AS valor
FROM companies
WHERE logo_url LIKE '%/object/public/logos/%' OR logo_url LIKE '%/object/sign/logos/%'
UNION ALL
SELECT 'branches.logo_url', id::text, logo_url
FROM branches
WHERE logo_url LIKE '%/object/public/logos/%' OR logo_url LIKE '%/object/sign/logos/%'
UNION ALL
SELECT 'campaigns.logo_url', id::text, logo_url
FROM campaigns
WHERE logo_url LIKE '%/object/public/logos/%' OR logo_url LIKE '%/object/sign/logos/%'
UNION ALL
SELECT 'campaigns.banner_urls', id::text, b
FROM campaigns, unnest(banner_urls) AS b
WHERE b LIKE '%/object/public/logos/%' OR b LIKE '%/object/sign/logos/%'
UNION ALL
SELECT 'platform_settings.logo_url', 'plataforma', logo_url
FROM platform_settings
WHERE logo_url LIKE '%/object/public/logos/%' OR logo_url LIKE '%/object/sign/logos/%'
UNION ALL
SELECT 'platform_settings.logo_url_relatorios', 'plataforma', logo_url_relatorios
FROM platform_settings
WHERE logo_url_relatorios LIKE '%/object/public/logos/%' OR logo_url_relatorios LIKE '%/object/sign/logos/%'
UNION ALL
SELECT 'profiles.chat_avatar_url', id::text, chat_avatar_url
FROM profiles
WHERE chat_avatar_url LIKE '%/object/public/logos/%' OR chat_avatar_url LIKE '%/object/sign/logos/%'
UNION ALL
SELECT 'image_generations.image_url', id::text, image_url
FROM image_generations
WHERE image_url LIKE '%/object/public/logos/%' OR image_url LIKE '%/object/sign/logos/%';
```

### 4. Checagem defensiva: caminhos crus no formato antigo

Estas colunas guardam caminhos crus (sem o nome do bucket). Um caminho
começando por `plataforma/`, `empresas/` ou `filiais/` seria um resto
do layout antigo do bucket `logos`:

```sql
SELECT 'campaign_sponsors.logo_path' AS fonte, id::text AS registro, logo_path AS valor
FROM campaign_sponsors
WHERE logo_path LIKE 'plataforma/%' OR logo_path LIKE 'empresas/%' OR logo_path LIKE 'filiais/%'
UNION ALL
SELECT 'campaign_sponsors.banner_path', id::text, banner_path
FROM campaign_sponsors
WHERE banner_path LIKE 'plataforma/%' OR banner_path LIKE 'empresas/%' OR banner_path LIKE 'filiais/%'
UNION ALL
SELECT 'banner_describe_attachments.storage_path', id::text, storage_path
FROM banner_describe_attachments
WHERE storage_path LIKE 'plataforma/%' OR storage_path LIKE 'empresas/%' OR storage_path LIKE 'filiais/%'
UNION ALL
SELECT 'chat_attachments.file_path', id::text, file_path
FROM chat_attachments
WHERE file_path LIKE 'plataforma/%' OR file_path LIKE 'empresas/%' OR file_path LIKE 'filiais/%';
```

## Árvore de decisão

- **Queries 3 e 4 sem nenhuma linha** → nenhum arquivo está
  referenciado: os 10 arquivos são órfãos do layout antigo. Apagar
  (ver "Como apagar" abaixo).
- **Query 3 ou 4 com linhas** → o arquivo listado está EM USO.
  **Não apagar.** Anotar tabela/coluna/registro e adicionar a
  referência na coleta da varredura (`collectReferences` em
  `src/lib/storage-orphan-sweep.server.ts`) antes de qualquer exclusão;
  manter a chave `STORAGE_SWEEP_INCLUDE_LOGOS` desligada.
- **Depois de apagar:** o bucket fica vazio e pode ficar (não custa
  nada sem arquivos) ou ser removido no Dashboard (Storage → bucket
  `logos` → excluir). As policies "Scoped logos ..." ficam inertes
  sem os arquivos — não precisa mexer nelas.

## Como apagar (depois de confirmar zero referências)

Duas opções — a primeira é a mais simples; a segunda deixa rastro na
tabela `storage_orphan_sweep_runs`:

1. **Pela interface do Storage:** Storage → bucket `logos` →
   selecionar os 10 arquivos → Delete. Conferir depois com a query 2
   (tem que voltar 0 linhas).
2. **Pela varredura:** definir `STORAGE_SWEEP_INCLUDE_LOGOS=true` nas
   variáveis da Vercel (Production) e fazer redeploy. O job continua
   em dry-run (sem `STORAGE_SWEEP_LIVE`): os 10 arquivos aparecem
   como órfãos no resumo da execução, sem apagar nada. Conferir a
   lista na tabela `storage_orphan_sweep_runs` e só então ligar
   `STORAGE_SWEEP_LIVE=true` (previsto na Frente 7, após 2–3 semanas
   de dry-run) na próxima execução semanal. Depois da limpeza, remover
   as duas variáveis e fazer redeploy (volta ao dry-run sem `logos`).

**Atenção:** sem nenhuma referência coletada, com a chave ligada TODOS
os objetos do `logos` viram órfãos — a chave nunca é ligada por padrão
e só faz sentido depois das queries 3 e 4 acima.

## Rodada única em todas as empresas (Frente 10)

A varredura da Frente 7 já cobre TODAS as empresas: a coleta de
referências (`collectReferences`) lê todas as linhas de cada tabela,
sem filtro por empresa. A primeira execução em dry-run já é a rodada
geral — não existe segundo job. O relatório dessa execução (tabela
`storage_orphan_sweep_runs`) é a medida do vazamento total atual.
