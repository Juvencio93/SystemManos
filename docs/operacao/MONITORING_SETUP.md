# Guia de Monitoramento Manos Tech

## 1. Monitoramento Atual
O sistema utiliza os recursos nativos do Supabase e captura de erros interna:
- **Supabase Logs Explorer:** Para erros de banco de dados, autenticação e funções de servidor.
- **Relatório Interno:** `error-reporting.ts` para capturar falhas de runtime no frontend sem dependências externas.

### Queries no Logs Explorer:
- **Erros de Autenticação:** `select * from auth.audit_log where level = 'error' order by timestamp desc`
- **Erros de Banco (RLS):** Busque em `postgres_logs` por "permission denied".
- **Privacidade:** Os logs são filtrados para não registrar senhas, tokens ou dados pessoais (PII).

## 2. Sentry (Opcional)
A estrutura para o Sentry está preparada em `src/lib/error-reporting.ts`, mas **não está configurada**. 
- O sistema opera normalmente sem o Sentry.
- Para ativar, é necessário fornecer um `DSN` e configurar a remoção de PII no painel do Sentry.

## 3. Alertas Recomendados
Monitore o Logs Explorer para:
- **Cobrança:** Falhas em webhooks do Asaas.
- **IA:** Erros de limite ou exaustão de tokens.
- **Segurança:** Picos de erros 401/403 (Unauthorized/Forbidden).
