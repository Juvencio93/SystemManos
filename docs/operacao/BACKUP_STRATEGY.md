# Estratégia de Backup Manos Tech

## 1. Backup Nativo (Supabase)
- **Status:** precisa ser confirmado no painel do projeto; o estado saudável do banco não comprova a existência ou a retenção dos backups.
- **Plano:** a disponibilidade e a retenção dependem do plano contratado. Não assumir retenção sem conferir o painel.
- **Escopo:** Apenas Banco de Dados PostgreSQL (DUMP Lógico/Físico).
- **Storage:** O backup nativo **NÃO** cobre arquivos do Supabase Storage.

## 2. Backup Lógico Semanal
- **Banco de Dados:** Utilizar `pg_dump` semanalmente.
- **Storage:** Sincronização via CLI (`supabase storage cp`) para um bucket S3 privado ou armazenamento externo.
- **Segurança:** Chaves de backup devem ser armazenadas no Gestor de Segredos do CI/CD (ex: GitHub Actions, GitLab CI), nunca no código.

## 3. Monitoramento
- **Logs:** Logs Explorer do Supabase (Erros de RLS, Auth e Edge Functions).
- **Sentry:** Integração recomendada para monitoramento de erros de runtime (Frontend/Backend).
- **Alertas:** Configurar alertas de limite de IA e falhas de cobrança via Webhooks do Asaas.

## 4. Validação

Consulte `PLANO_BACKUP_RECUPERACAO.md`. Um arquivo existente não basta: o backup só é válido depois de uma restauração mensal em ambiente isolado.
