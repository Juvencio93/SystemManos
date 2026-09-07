# Plano de Implementação: Central Operacional — Manos Tech IA

Este plano descreve a reestruturação do módulo de IA para o perfil Administrador, substituindo o chat genérico por um painel de análise estratégica focado no desempenho das empresas e filiais.

## Mudanças Propostas

### 1. Banco de Dados e Segurança

- Criação da tabela `operational_analyses` para armazenar o histórico de snapshots e resumos da IA.
- Criação da tabela `operational_alerts` para rastreio persistente de problemas, com status de atendimento e resolução.
- Implementação de Row Level Security (RLS) restritiva: apenas o papel `adm` terá acesso a estas tabelas.
- Migrações versionadas com Grants explícitos.

### 2. Backend e Lógica de Negócio

- Desenvolvimento da `analyzeOperations` no servidor:
  - Coleta de métricas reais (conexões, visitantes, recorrência) de todas as empresas e filiais ativas.
  - Cálculo objetivo de status (Crítico, Atenção, Destaque, Estável, Sem dados) baseado em regras fixas.
  - Agrupamento de resultados por Matriz, separando o desempenho de cada unidade.
- Integração refinada com a IA:
  - Uma única chamada por análise enviando apenas o resumo das métricas (sem PII).
  - A IA gera o Resumo Executivo e recomendações práticas baseadas no Perfil Comercial das empresas.
- Implementação de controle de custos e performance:
  - Cooldown de 10 minutos entre análises.
  - Bloqueio de execuções simultâneas.

### 3. Interface do Administrador

- Remoção completa do chat livre e sugestões de perguntas na página inicial do ADM.
- Novo Card "Central Operacional":
  - Botão manual "Atualizar análise operacional" (análise sob demanda).
  - Exibição da última análise salva com data e hora.
  - Seção de indicadores superiores (KPIs de saúde da plataforma).
  - Seções coloridas (Vermelho, Amarelo, Verde, Cinza) listando cada operação/filial.
- Funcionalidades de Gestão:
  - Botões para abrir detalhes da empresa, contato via WhatsApp (com número inteligente) e marcação de atendimento.
  - Modal para registro de observações ao marcar como atendido/resolvido.

### 4. Segurança e Privacidade

- Garantia de que nenhuma informação pessoal de visitantes é enviada para a API de IA.
- Validação rigorosa de papéis (Role-based access control) no servidor.

## Detalhes Técnicos

- Framework: TanStack Start (React 19).
- Banco de Dados: Supabase (PostgreSQL).
- IA: Google Gemini (via gateway interno).
- Estado: React Query para persistência e cache no frontend.
