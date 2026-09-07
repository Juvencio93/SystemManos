# Plano de Melhoria da Análise Operacional (IA)

Melhorar a qualidade dos diagnósticos e recomendações do Gerente Operacional IA, tornando-os específicos, baseados em dados reais e evitando alucinações ou repetições genéricas.

## Objetivos

- Diagnósticos precisos para unidades em observação (regra de 5 dias).
- Análise comparativa real para unidades com histórico (últimos 7 dias vs. 7 dias anteriores).
- Alertas específicos para unidades críticas (zero conexões).
- Resumo executivo estruturado por empresa com evidências numéricas.

## Alterações Técnicas

### 1. Servidor de IA (`src/lib/ai.server.ts`)

- **Refinamento do System Prompt**:
  - Instruções explícitas para citar números reais (conexões, variação, dias de operação).
  - Proibição de inventar tendências ou campanhas.
  - Estrutura obrigatória: Fato (dado real) -> Diagnóstico (o que o dado significa) -> Recomendação (o que fazer).
  - Regras específicas para o status "observacao" (período inicial).
  - Regras para "zero conexões" (verificação física/técnica).
- **Enriquecimento do Contexto**: Passar métricas detalhadas (prev7d, variação, data da última conexão, idade da operação) no `userContent`.

### 2. Utilitários Operacionais (`src/lib/operational.utils.server.ts`)

- **Aprimoramento do `reason` determinístico**:
  - Atualizar a lógica de `processUnit` para gerar descrições mais ricas que alimentam a IA.
  - Ex: "Registrou 5 conexões nos primeiros 3 dias de operação" em vez de apenas "Operação em fase inicial".

### 3. Funções de Negócio (`src/lib/operational.functions.ts`)

- **Enriquecimento do `enrichedOrganizations`**:
  - Melhorar o fallback determinístico para casos onde a IA falha ou a unidade está em observação, seguindo exatamente o exemplo solicitado (Nome da empresa + números reais).
  - Garantir que a `matrix` e `branches` carreguem os metadados necessários para a UI.

### 4. Interface do Usuário (`src/routes/_authenticated/gerente-operacional.tsx`)

- **Ajuste na exibição do Diagnóstico**:
  - Garantir que a seção de "Resumo Executivo" renderize os textos enriquecidos sem filtros que simplifiquem demais a informação.
  - Manter a ordenação solicitada: Crítico -> Atenção -> Observação -> Estável.

## Verificação

1. Validar isolamento (Solver2 aparece apenas na Solver Patrimonial).
2. Verificar se Boteco do Barão e Panificadora Campos exibem suas 5 conexões e explicam a fase de observação.
3. Checar se variações percentuais inválidas (divisão por zero) são tratadas como números absolutos.
4. Testar build, lint e tipos.
