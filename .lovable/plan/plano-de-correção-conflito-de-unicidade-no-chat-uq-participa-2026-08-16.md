# Plano de Correção: Conflito de Unicidade no Chat (uq_participant_matriz)

O objetivo é eliminar o erro `duplicate key value violates unique constraint uq_participant_matriz` na função `getOrCreateConversation`, garantindo que a criação de conversas e inserção de participantes seja resiliente a condições de corrida e duplicidade.

## Diagnóstico Técnico
A constraint `uq_participant_matriz` impede que uma mesma conversa tenha mais de um registro com `participant_type = 'matriz'`. O erro ocorre porque:
1. A busca por conversa existente pode falhar em encontrar um registro recém-criado por outra requisição simultânea.
2. O código tenta inserir o participante 'matriz' em uma conversa que já possui um, violando a regra de negócio/banco.

## Alterações Propostas

### 1. Reforço da Busca Prévia
- Aprimorar a query de verificação de conversas existentes para garantir que todas as conversas da empresa sejam consultadas antes de qualquer tentativa de `INSERT`.

### 2. Inserção Segura (ON CONFLICT)
- Modificar a inserção em `conversation_participants` para usar `upsert` ou tratar o conflito de forma que, se o participante 'matriz' já existir, a operação não resulte em erro fatal.
- Nota: Como o Supabase JS SDK não suporta `ON CONFLICT DO NOTHING` diretamente para inserts múltiplos com filtragem complexa de forma atômica simples, usaremos um tratamento de erro robusto e re-verificação.

### 3. Recuperação de Conflito Atômica
- Em caso de erro `23505` (Unique Violation), a função realizará uma busca final de "última instância" para retornar a conversa que causou o conflito, evitando que o usuário receba uma mensagem de erro.

## Detalhes Técnicos
- Arquivo afetado: `src/lib/chat-validation.functions.ts`.
- Função: `getOrCreateConversation`.
- Preservação: Nenhuma alteração em RLS, lógica de presença ou interface visual.

## Validação
- Execução de `tsgo` para garantir integridade de tipos.
- Verificação lógica da deduplicação do array `finalParticipants`.
- Simulação mental de cliques duplos (concorrência).
