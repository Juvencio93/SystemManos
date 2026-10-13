# Estratégia de backup — Supabase Free

Revisão: 12 de outubro de 2026.

## Plano e limites considerados

O projeto principal está no plano Supabase Free. Não há backup diário gerenciado do banco nesse plano; a cópia do PostgreSQL será exportada por GitHub Actions e enviada criptografada ao Cloudflare R2. Os objetos do Storage usam uma rotina separada, porque dump do banco não guarda os arquivos.

Valores observados nesta auditoria: banco em torno de 21 MB de 500 MB; objetos em torno de 213 MiB de 1 GB. A exportação diária do banco e a cópia completa do Storage a cada 14 dias foram escolhidas para manter a transferência estimada em cerca de 1,1 GB por mês antes do tráfego normal da aplicação, abaixo dos 5 GB de egress incluídos no Free no volume atual. Isso é estimativa, não garantia: acompanhar uso no painel e ajustar se o sistema crescer.

O R2 Standard inclui 10 GB-month e operações dentro da faixa gratuita atual. Oito cópias completas do Storage, no volume medido, ocupariam aproximadamente 1,7 GB, além dos dumps do banco e de outros objetos da conta Cloudflare. Conferir o consumo total da conta. [Preços R2](https://developers.cloudflare.com/r2/pricing/)

## Rotinas propostas no repositório

| Componente | Frequência | Retenção | Verificação |
|---|---:|---:|---|
| Banco: roles, schema e dados | Diária, 04:17 no horário de Brasília, via GitHub Actions, após ativar o cron | 35 dias via regra de lifecycle do R2 | SHA-256 e download de conferência após upload |
| Supabase Storage: cinco buckets | A função respeita intervalo mínimo de 14 dias; o cron atual a chama semanalmente | Oito versões | `HeadObject` confere tamanho; manifesto guarda SHA-256 por arquivo |
| Código, migrações e função | Cada alteração versionada no Git | Retenção normal do remoto Git | Revisão do histórico e deploy reproduzível |
| Restauração | Mensal, em projeto separado | Relatório do ensaio | Conferir tabelas, login de teste e objetos restaurados |

O fluxo do banco usa `supabase db dump`, que aplica filtros próprios do Supabase e produz os arquivos de roles, schema e dados; o dump é criptografado com `age` antes de sair do runner. [Backup e restauração pela CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)

## Ativação que ainda depende de configuração externa

1. No GitHub, cadastrar os secrets `SUPABASE_DB_URL`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID` e `R2_SECRET_ACCESS_KEY`.
2. Cadastrar as variables `SUPABASE_PROJECT_REF`, `R2_BUCKET_NAME` e `BACKUP_AGE_RECIPIENT`.
3. Gerar a identidade de criptografia com `age-keygen -o age-identity.txt`; obter o destinatário com `age-keygen -y age-identity.txt`. Cadastrar somente o destinatário como variable `BACKUP_AGE_RECIPIENT`.
4. Guardar a chave privada `age-identity.txt` fora do GitHub e do próprio R2, em local seguro com cópia de contingência. Sem ela, o dump não pode ser descriptografado.
5. No bucket R2, criar uma regra de lifecycle limitada ao prefixo `database-backups/` para excluir objetos após 35 dias. Não aplique regra sem prefixo: o mesmo bucket guarda os arquivos do Storage.
6. Confirmar que a fonte da função `backup-storage-to-r2` está versionada e corresponde à versão ativa no Supabase; conferir os secrets e o cron atuais.
7. Ativar o cron diário depois de cadastrar os secrets e variables. Executar o workflow manualmente uma vez e conferir o artefato no R2; depois, conferir uma execução agendada.
8. Fazer o primeiro teste de restauração isolada antes de declarar a recuperação pronta.

O workflow não inicia até todos os secrets e variables necessários estarem configurados. GitHub Actions executa o agendamento apenas para a branch padrão e pode desativar schedules após período prolongado sem atividade no repositório. Conferir a aba Actions periodicamente e manter `workflow_dispatch` disponível.

## Regras operacionais

- Não guardar connection strings, tokens, chaves R2 ou identidade privada `age` no repositório.
- Não usar a chave de produção para restaurar sobre o banco de produção. O teste usa um projeto separado.
- O estado `succeeded` do cron do Supabase só confirma que a chamada agendada foi executada/enfileirada; o `last-run.json`, manifesto e objetos no R2 são a evidência do backup Storage concluído.
- O plano Free e os limites do R2 podem mudar. Antes de aumentar a frequência, conferir egress no Supabase e uso total do R2.
- Supabase Storage precisa de cópia separada do banco; a restauração de objetos usa o manifesto para conferir tamanho e SHA-256.
