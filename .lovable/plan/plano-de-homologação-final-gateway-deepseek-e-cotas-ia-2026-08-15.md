# Plano de Homologação Final - Gateway DeepSeek e Cotas IA

Homologação real do fluxo de IA nos perfis ADM, Matriz e Filial, validando a exclusividade do DeepSeek, a integridade das cotas e o comportamento sob estresse e falha.

## Alterações Técnicas (Refinamento)

### 1. Garantia de Quotas Dinâmicas e Concorrência
- Revisar `src/lib/ai-limits.server.ts` para garantir que a verificação de cota use `count >= limit` antes de fornecer a função `increment()`.
- Garantir que `Filial` consulte corretamente o saldo da `Matriz` (se aplicável à lógica de negócio onde filiais consomem da cota da empresa). *Nota: O sistema atual define cota 1 para filial e 10 para matriz no código, mas a regra de negócio pede compartilhamento dinâmico.*
- Ajustar `increment_ai_usage_safe` (RPC) para ser a única fonte de verdade para incremento atômico, prevenindo sobre-consumo em chamadas simultâneas.

### 2. Fluxo de Erros e Logs
- Garantir que falhas técnicas (timeout, 5xx do DeepSeek) retornem erro estruturado com `requestId` mas **NÃO** chamem a função `increment()`.
- Padronizar o prefixo `IA-` no frontend para qualquer erro retornado pelo `askAgent`.

## Roteiro de Testes e Evidências

### Teste 1: Homologação por Perfil (ADM, Matriz, Filial)
Para cada perfil, será realizada a pergunta: **"Como criar uma promoção para o mês de agosto?"**
- **Evidência:** Captura de `requestId`, `provider` (deepseek), `model` (deepseek-chat) e o texto da resposta.
- **Validação:** Verificação do faturamento da cota no banco antes e depois da resposta bem-sucedida.

### Teste 2: Concorrência e Limite
- Executar duas chamadas `askAgent` quase simultâneas quando o saldo for 1.
- **Resultado Esperado:** Apenas uma chamada deve ser processada com sucesso; a segunda deve retornar erro de cota atingida.

### Teste 3: Falha Controlada
- Simular erro de rede ou invalidar temporariamente o segredo do gateway.
- **Resultado Esperado:** Interface exibe erro `IA-XXXXXXXX`, e o contador de cota permanece inalterado.

## Detalhes Técnicos
- **Timezone:** `America/Sao_Paulo` (Reset à meia-noite via `reset_daily_ai_usage`).
- **Isolamento:** Uso de `AI_GATEWAY_SECRET` (Gateway) e `CRON_SECRET` (Backups) devidamente separados.
- **Privacidade:** Logs estruturados sem PII ou chaves de API.
