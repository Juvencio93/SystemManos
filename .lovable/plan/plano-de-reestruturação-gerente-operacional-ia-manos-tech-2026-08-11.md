# Plano de Reestruturação: Gerente Operacional IA (Manos Tech)

Este plano detalha a reestruturação definitiva da Central Operacional para Administradores, focando em análise diária automatizada, interface compacta no dashboard e uma página dedicada de gestão de alertas.

## Mudanças Estruturais

### 1. Banco de Dados e Segurança

- Migração das tabelas `operational_analyses` e `operational_alerts` para suportar versionamento diário e controle de alertas.
- Implementação de RLS estrito: apenas o papel `admin` terá acesso a estas tabelas.
- Função RPC `process_operational_alert` para gerenciar a persistência de alertas sem duplicidade (idempotência).

### 2. Backend e Job Diário

- Criação de um endpoint protegido em `src/routes/api/public/operational-job.ts` para execução via Cron às 06:00 (America/Sao_Paulo).
- Refatoração de `src/lib/operational.functions.ts`:
  - Lógica de métricas objetivas (conexões 7d vs 7d anteriores, tendência 30d, etc).
  - Classificação no backend (Destaque, Atenção, Crítico, Estável, Sem Dados).
  - snapshot estruturado enviado para IA DeepSeek (uma única chamada por dia).
  - Proteção de idempotência para garantir apenas uma análise por data.

### 3. Interface do Administrador

- **Dashboard**: Substituição do card de chat/análise manual por um card informativo compacto com contadores (Crítico/Atenção/Destaque) e status da última atualização.
- **Página Dedicada**: Criação de `src/routes/_authenticated/gerente-operacional.tsx` para exibição detalhada dos alertas, agrupados por empresa/matriz.
- **Interação**: Botões para abrir empresa, entrar em contato via WhatsApp (sanitizado) e marcar alertas como atendidos/resolvidos.

### 4. Menu e Navegação

- Adição do item "Gerente Operacional IA" no menu lateral do ADM (posição 2, abaixo de Painel).
- Proteção de rota para garantir que apenas ADMs acessem `/gerente-operacional`.

## Detalhes Técnicos

- **Tecnologias**: TanStack Start (Server Functions), Supabase (PostgreSQL/RLS), DeepSeek (IA), Lucide React (Ícones).
- **Fuso Horário**: Uso obrigatório de `America/Sao_Paulo` para agendamento e exibição.
- **IA**: Otimização de tokens enviando snapshot compacto; a IA atua apenas como consultora estratégica, não como classificadora de dados brutos.
