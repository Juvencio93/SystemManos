# Plano de backup e recuperação

Revisão: 12 de outubro de 2026.

## Objetivos realistas para o plano Free

- Banco: RPO alvo de 24 horas depois que o workflow diário estiver configurado e confirmado.
- Arquivos: RPO atual de até 14 dias, conforme a janela da função Storage e os limites de transferência do Supabase Free.
- Restauração: validar mensalmente em um projeto Supabase isolado.
- RTO: ainda não medido; só definir após o primeiro ensaio cronometrado.

## Cobertura

1. PostgreSQL: dump separado de roles, schema e dados via Supabase CLI, criptografado com `age` e enviado ao R2.
2. Storage: cópia independente dos cinco buckets, com manifesto, tamanho e SHA-256 por arquivo.
3. Código e migrações: Git remoto, incluindo a fonte da Edge Function.
4. Segredos: gerenciadores de segredos do GitHub/Supabase/Cloudflare; chave privada de descriptografia guardada fora desses destinos.

## Estado atual

- O workflow e scripts foram adicionados ao repositório, mas precisam dos secrets/variables do GitHub e ainda não produziram um dump confirmado.
- A função `backup-storage-to-r2` versão 9 está publicada e cobre os cinco buckets; o primeiro manifesto dessa versão ainda precisa ser confirmado no R2.
- A regra de retenção R2 para `database-backups/` precisa ser criada no painel Cloudflare.
- Nenhuma restauração completa foi executada. Portanto, ainda não há recuperação comprovada.

## Ativação

Siga `BACKUP_STRATEGY.md` e `BACKUP_R2_GUIDE.md`. Depois da configuração, execute o workflow manualmente, valide hash remoto e faça uma restauração em projeto separado antes de considerar o processo operacional.

## Ensaio mensal

1. Selecionar uma cópia identificada e obter a chave privada `age` guardada fora do ambiente de produção.
2. Criar um projeto Supabase isolado e salvar sua connection string separadamente.
3. Descriptografar e restaurar roles, schema e dados usando o procedimento em `RESTORATION.md`.
4. Restaurar objetos pelo manifesto com `scripts/restore-storage-from-r2.mjs`.
5. Conferir tabelas e vínculos principais (`companies`, `branches`, `user_roles`, `hotspot_devices`, `campaigns`, `visitors` e `company_charges`), login de teste, políticas RLS e arquivos.
6. Desativar integrações externas no ambiente de teste para impedir cobranças, webhooks e mensagens reais.
7. Registrar duração, cópia usada, divergências e resultado. Remover o projeto isolado quando terminar.

O backup só será considerado recuperável quando banco e arquivos forem restaurados e as verificações funcionais forem aprovadas.
