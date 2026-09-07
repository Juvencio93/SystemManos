# Plano de Migração Exclusiva para DeepSeek e Ajuste do AI Gateway

Remoção total do Google Gemini e consolidação do DeepSeek como único provedor de IA da Manos Tech, garantindo o funcionamento correto em todos os perfis (ADM, Matriz, Filial) através de um Gateway seguro.

## Etapas de Implementação

### 1. Limpeza Global do Gemini
- [ ] **src/lib/ai-gateway.server.ts**: Remover toda a lógica de fallback para Gemini, a constante `GEMINI_API_URL` e as verificações de `GOOGLE_AI_API_KEY`.
- [ ] **src/lib/ai-gateway.test.ts**: Remover testes relacionados ao fallback para Gemini.
- [ ] **src/components/app/ai/AiStructuredResponse.tsx**: Atualizar textos de ajuda que mencionam Gemini.
- [ ] **src/lib/company.server.ts**: Atualizar prompts que mencionam Gemini.
- [ ] **Busca Global**: Remover qualquer outra ocorrência funcional de "Gemini", "gemini-1.5-flash", "gemini-fallback".

### 2. Reformulação do Gateway de IA
- [ ] **Segurança**: Migrar a autenticação do Gateway para `AI_GATEWAY_SECRET` (removendo o uso de `CRON_SECRET` para este fim).
- [ ] **Configuração**: Garantir que o Gateway utilize apenas `DEEPSEEK_API_KEY`, `deepseek-chat` e o provedor `deepseek`.
- [ ] **Resiliência**: Em caso de erro do DeepSeek (402, 429, 5xx), retornar um erro estruturado JSON para a interface sem tentar outros provedores.

### 3. Correção do Fluxo Real (Interface -> Gateway)
- [ ] **src/lib/ai.server.ts**: Atualizar a chamada para o Gateway para usar `AI_GATEWAY_SECRET`. Garantir que a URL do Gateway esteja correta para o ambiente de execução.
- [ ] **Auditoria de Payload**: Verificar se a serialização/deserialização do TanStack Start está preservando os campos `text` e `error`.
- [ ] **Cotas e Cooldown**: Confirmar que o consumo de cota (`increment_ai_usage_safe`) só ocorre em caso de sucesso (HTTP 200 com texto).

### 4. Validação e Homologação
- [ ] **Ambiente**: Garantir que `AI_GATEWAY_SECRET` esteja definido.
- [ ] **Testes de Interface**: Realizar perguntas reais nos perfis ADM, Matriz e Filial.
- [ ] **Logs**: Verificar que nenhum PII ou segredo é exposto nos logs.
- [ ] **Qualidade**: Rodar TypeScript, ESLint e Build.

## Detalhes Técnicos
- O Gateway deve retornar `401` para tokens inválidos.
- Respostas de erro devem ser amigáveis: "Não foi possível obter a resposta agora. Tente novamente."
- A remoção de `GOOGLE_AI_API_KEY` das configurações (Lovable/Supabase) será o último passo após a confirmação de sucesso.
