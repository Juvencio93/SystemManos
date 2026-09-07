# Resumo de Configuração: Backup & Monitoramento

## 1. Configuração Atual
- **Backup:** Nativo do Supabase (Apenas Banco de Dados). Retenção padrão (7-30 dias).
- **Storage:** Sem backup nativo automático.
- **Monitoramento:** Logs Explorer do Supabase (Autenticação, Banco, Funções) + relatório interno de erros (`error-reporting.ts`).
- **Privacidade:** Logs configurados para evitar o registro de senhas, tokens, cookies, telefones ou e-mails.

## 2. Configuração Proposta
- **Rotina de Backup:** Lógica semanal via `pg_dump` (banco) e Supabase CLI (storage) para armazenamento privado.
- **Sentry:** Estrutura preparada no código, porém opcional e não configurada (sem DSN).

## 3. Ações Concluídas
- Movimentação dos guias para `docs/operacao/`.
- Mapeamento de logs críticos com filtros de privacidade.
- Criação de manuais de restauração e monitoramento.
- Validação de isolamento de dados (`unitScope`).

## 4. Próximos Passos (Opcional)
- **Sentry:** Para habilitar, forneça o `SENTRY_DSN`. O sistema funciona plenamente sem ele.
- **Destino de Backup:** Definir bucket S3 ou local externo para armazenamento privado dos backups semanais.

## 5. Como Testar
- **Logs:** Provoque um erro 404 proposital e verifique o Logs Explorer no painel do Supabase.
- **Privacidade:** Verifique se os logs de rede ou console não expõem tokens em texto claro.
