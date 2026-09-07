# Plano de Implementação: Criar Banner com IA

Este plano descreve a implementação da funcionalidade "Criar Banner com IA", exclusiva para o perfil Filial, utilizando o DeepSeek para gerar prompts otimizados para ferramentas de geração de imagem.

## Backend e Lógica

- **Novo Prompt de Sistema**: Adicionar `BANNER_SYSTEM` em `src/lib/company.server.ts`.
  - Instruções para o DeepSeek considerar o contexto da empresa (segmento, descrição).
  - Regra de interatividade: uma pergunta objetiva se faltar informação.
  - Se houver informação, gerar exatamente duas opções de prompt com título e descrição.
  - Inclusão obrigatória do lembrete sobre anexos manuais.
- **Nova Server Function**: Criar `src/lib/banner-agent.functions.ts`.
  - Função `askBannerAgent` protegida por `requireSupabaseAuth`.
  - Validação rigorosa de acesso: apenas usuários com `role === "filial"` podem acessar.
  - Reuso de `resolveContext` e `computeCompanySnapshot` para garantir isolamento e contexto real.
- **Gestão de Cotas**: 
  - Consultas de esclarecimento (quando a IA faz uma pergunta) não consomem cota.
  - A entrega final dos dois prompts consome exatamente 1 unidade da cota diária.
  - Utilização de `checkAiLimitAndIncrement` com fluxo de confirmação após sucesso da IA.

## Frontend e Interface

- **Componente de UI**: Modificar `src/components/app/ai-agent-card.tsx`.
  - Adicionar nova seção/diálogo "Criar Banner com IA" visível apenas para Filiais.
  - Implementar interface de mini-chat para conversas de esclarecimento.
  - Exibição das opções de prompt com botão de "Copiar prompt".
  - Aviso destacado com o lembrete obrigatório.
  - Estados de carregamento e desabilitação de botões durante o processamento.

## Detalhes Técnicos

- **Integração de IA**: Uso exclusivo de `callGateway` (DeepSeek). Sem visão computacional ou upload de arquivos.
- **Segurança**: 
  - Verificação de permissões no lado do servidor.
  - Sanitização de logs para evitar exposição de PII ou prompts sensíveis.
- **Validação**: Execução de TypeScript, ESLint e Build após a implementação para garantir estabilidade.

## Critérios de Aceite

- O botão/seção só aparece para usuários Filial.
- A IA faz perguntas se a solicitação for vaga (ex: "quero um banner").
- A IA entrega dois prompts detalhados e um lembrete se a solicitação for clara (ex: "quero um banner para promoção de pizza de calabresa").
- O consumo de cota ocorre apenas na entrega dos prompts.
- A cópia dos prompts funciona corretamente.
