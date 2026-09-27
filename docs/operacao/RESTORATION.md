# Procedimento de Restauração Manos Tech

Este documento descreve como restaurar o banco de dados e arquivos do Storage em um ambiente separado.

## 1. Restauração do Banco de Dados (PostgreSQL)

Assumindo que você tem um arquivo `dump_semanal.sql`:

```bash
# 1. Obtenha as credenciais do novo banco de dados (Host, User, DB Name)
# 2. Execute o comando de restauração
psql -h db.seu-projeto.supabase.co -U postgres -d postgres -f dump_semanal.sql
```

## 2. Restauração de Arquivos (Storage)

Os arquivos devem ser restaurados via CLI do Supabase ou script utilizando as chaves de API do novo ambiente:

```bash
# Exemplo de sincronização de volta para o bucket
# Substitua ./backup_storage pelo caminho local do seu backup
supabase storage cp -r ./backup_storage/campaign-assets s3://campaign-assets
```

## 3. Validação Funcional Pós-Restauração
- **Integridade:** Verifique se as tabelas `companies`, `branches` e `user_roles` possuem dados.
- **Acesso:** Tente logar com um usuário existente.
- **Mídia:** Verifique se as logos das empresas e banners das campanhas aparecem no painel e no portal cativo.
- **Financeiro:** Verifique se o histórico de cobranças (`company_charges`) está correto.
