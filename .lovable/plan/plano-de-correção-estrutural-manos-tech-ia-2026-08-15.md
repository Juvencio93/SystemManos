# Plano de Correção Estrutural - Manos Tech IA

Este plano detalha a remoção da arquitetura de loop HTTP interno e a consolidação do DeepSeek como provedor exclusivo, garantindo isolamento de dados e correção do fluxo de cotas.

## 1. Ajustes no Backend (Servidor)

### Consolidação do Gateway Interno
* **Arquivo:** `src/lib/ai.server.ts`
* **Mudança:** Remover a chamada `fetch` para a rota interna `/api/public/ai-gateway`. Implementar a chamada direta ao DeepSeek utilizando a `DEEPSEEK_API_KEY`.
* **Segurança:** A `AI_GATEWAY_SECRET` será removida do fluxo, pois não haverá mais endpoint público.
* **Modelo:** Garantir uso exclusivo do modelo `deepseek-chat`.

### Refatoração de Insights e Fluxo de IA
* **Arquivo:** `src/lib/insights.functions.ts`
* **Mudança:** 
    * Refatorar `askAgent` para gerar o `requestId` no início do fluxo.
    * Garantir que falhas técnicas não consumam cota.
    * Implementar commits atômicos de cota somente após sucesso da IA.
    * Envolver etapas em `try/catch` com estágios técnicos identificáveis.

### Controle de Cotas e Pool Dinâmico
* **Arquivo:** `src/lib/ai-limits.server.ts`
* **Mudança:** Corrigir a lógica para garantir a reserva de 10 comandos para Matrizes e o pool compartilhado para Filiais, validando o resultado do incremento atômico.

## 2. Ajustes no Frontend (Interface)

### Componente de Chat (Manos Tech IA)
* **Arquivo:** `src/components/app/ai-agent-card.tsx`
* **Mudança:**
    * Remover tipagens `any`.
    * Exibir códigos de erro técnicos `IA-XXXXXXXX` baseados no `requestId`.
    * Limpar o campo de pergunta apenas após o sucesso.
    * Garantir que erros de snapshot ou rede não sejam mascarados.

### Limpeza do Dashboard
* **Arquivo:** `src/routes/_authenticated/dashboard.tsx`
* **Mudança:** Remover o `useEffect` de diagnóstico automático que consome cotas desnecessariamente a cada login.

## 3. Limpeza de Resíduos e Segurança

* **Remoção de Arquivos:** Excluir `src/routes/api/public/ai-gateway.ts` e `src/lib/diagnostic.functions.ts`.
* **Variáveis de Ambiente:** Garantir que `GOOGLE_AI_API_KEY` e referências ao Gemini sejam removidas do código funcional.
* **Segurança:** O arquivo `.env` deve ser sanitizado e mantido fora de qualquer versionamento ou exportação.

## 4. Homologação e Testes

* Criar script de teste para validar o isolamento de dados entre Filiais.
* Testar fluxos de: Sucesso, Erro de Rede, Cota Esgotada e Erro de IA.
* Validação real via interface nos perfis ADM, Matriz e Filial com a pergunta obrigatória: *"Como criar uma promoção para o mês de agosto?"*.

## Detalhes Técnicos

```text
Fluxo Final:
AiAgentCard -> askAgent (Server Fn) -> Snapshot (Branch Isolated) -> callGateway (Internal Lib) -> DeepSeek API -> Increment Quota -> Return
```

* Timeout: 30 segundos (AbortController).
* Timezone: America/Sao_Paulo (Reset e Logs).
* Logs: PII-Free (Sem nomes, e-mails ou prompts).
