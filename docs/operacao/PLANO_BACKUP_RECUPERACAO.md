# Plano de backup e recuperação

Revisão: 7 de outubro de 2026.

## Objetivos

- RPO do banco: até 24 horas sem PITR; até o intervalo contratado quando PITR estiver ativo.
- RPO dos arquivos: até 24 horas.
- RTO operacional: 4 horas para incidente crítico, sujeito ao volume e à disponibilidade dos fornecedores.
- Todo teste de restauração ocorre primeiro em projeto Supabase separado.

## Cobertura obrigatória

1. Banco PostgreSQL: esquema, dados, funções, políticas RLS e registros de autenticação cobertos pelo mecanismo contratado.
2. Supabase Storage: cópia separada dos objetos e manifesto com bucket, caminho, tamanho e hash quando disponível.
3. Código e migrações: repositório Git remoto.
4. Segredos: inventário no gerenciador de segredos, sem copiar valores para o repositório ou para o arquivo de backup.

O backup nativo do banco não contém os arquivos armazenados no Storage. Os dois conjuntos precisam de rotinas independentes.

## Rotina

| Frequência | Ação | Evidência |
|---|---|---|
| Diária | Confirmar sucesso do backup do banco e do Storage | Registro com data, responsável e identificador do backup |
| Semanal | Gerar dump lógico criptografado em destino externo | Arquivo, hash SHA-256 e log sem segredos |
| Mensal | Restaurar a cópia mais recente em ambiente isolado | Relatório do teste e checklist funcional |
| Trimestral | Simular indisponibilidade completa | Tempo medido, falhas encontradas e plano de correção |

## Validação mensal de restauração

1. Criar ou selecionar um projeto Supabase isolado, sem integração com clientes reais.
2. Restaurar o dump do banco no ambiente isolado.
3. Restaurar os objetos do Storage mantendo os mesmos caminhos.
4. Aplicar as variáveis de ambiente próprias do teste.
5. Conferir contagens e vínculos de `companies`, `branches`, `user_roles`, `hotspot_devices`, `campaigns`, `visitors` e `company_charges`.
6. Validar login e isolamento com ADM, revenda, matriz e filial de teste.
7. Conferir logos, banners e arquivos do portal.
8. Bloquear qualquer webhook, Telegram ou cobrança externa no ambiente restaurado.
9. Registrar horário inicial, horário final, resultado e divergências.
10. Destruir com segurança o ambiente temporário após a aprovação do relatório.

## Critério de aprovação

O backup só é considerado válido quando uma restauração isolada termina sem erro, os vínculos principais conferem e os testes de permissão não revelam dados entre clientes.

## Situação atual verificada

- Projeto Supabase ativo e saudável.
- O conector técnico não informa o plano contratado nem confirma o histórico de backups.
- A documentação anterior declarava retenção sem evidência suficiente; essa declaração não deve ser usada como confirmação.
- A validação completa fica pendente até conferir o painel de backups e executar o primeiro teste mensal em projeto isolado.
