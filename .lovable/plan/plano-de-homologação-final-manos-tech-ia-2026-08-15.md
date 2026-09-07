# Plano de Homologação Final Manos Tech IA

Este plano descreve as correções aplicadas e o roteiro de homologação final para garantir a estabilidade do assistente IA e o isolamento de cotas.

## Alterações Técnicas Realizadas
- **Consolidação DeepSeek**: Remoção total do Google Gemini. O `ai-gateway` utiliza exclusivamente DeepSeek com isolamento de logs (sem PII).
- **Cotas Dinâmicas**: Implementação de lógica de pooling para Filiais, respeitando a reserva de 10 comandos da Matriz.
- **Race Condition Protection**: Uso de `FOR UPDATE` no banco de dados via RPC para incrementos atômicos.
- **Preservação de Cota em Falhas**: O incremento só ocorre após o recebimento de texto válido do Gateway.
- **Diagnóstico Transparente**: Injeção de `requestId` em todo o fluxo para rastreabilidade de erros (código `IA-XXXXXXXX`).

## Roteiro de Homologação (Manual via Interface)

### 1. Teste de Perfil ADM
- **Pergunta**: "Como está a saúde da plataforma hoje?"
- **Expectativa**: Resposta imediata, requestId visível no log do console/rede.
- **Cota**: Nenhuma alteração (ADM é ilimitado).

### 2. Teste de Perfil Matriz
- **Pergunta**: "Como criar uma promoção para o mês de agosto?"
- **Expectativa**: Resposta estruturada.
- **Cota**: Verificar se o `ai_usage_today` da empresa incrementou exatamente +1.

### 3. Teste de Perfil Filial (Saldo Compartilhado)
- **Pergunta**: "Dicas para aumentar o cadastro de WhatsApp na unidade."
- **Expectativa**: Resposta estruturada.
- **Cota**: Verificar se o `ai_usage_today` da Filial incrementou +1 e se o saldo total da empresa respeita o pool.

### 4. Simulação de Falha (Teste de Resiliência)
- **Cenário**: Tentar enviar uma pergunta com o Gateway desativado (simulado via erro técnico).
- **Expectativa**: Exibição da mensagem com código `IA-XXXXXXXX`.
- **Cota**: **Não deve ser consumida**.

## Verificação de Segurança
- Auditoria de logs para garantir que tokens e PII não são expostos.
- Validação de que `/api/public/ai-gateway` rejeita chamadas sem o `AI_GATEWAY_SECRET`.

---
**Observação**: A aprovação final depende da apresentação dos requestIds gerados em cada perfil durante os testes reais na interface.
