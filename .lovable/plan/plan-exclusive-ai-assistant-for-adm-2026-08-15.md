# Plan - Exclusive AI Assistant for ADM

Implement a new exclusive AI experience for users with `role === "adm"`. This includes removing the fixed card and replacing it with a floating robot assistant that opens a chat interface with full platform context and optional web search via Tavily.

## User Review Required

> [!IMPORTANT]
> The AI will have access to all system data (Companies, Branches, Leads, Financials, etc.). Web search will be powered exclusively by the Tavily API, which requires the `TAVILY_API_KEY` to be set in the environment.

- **Floating Assistant:** The ADM will now see the floating robot mascot (similar to the one in Matriz/Filial) instead of the fixed dashboard card.
- **Full System Context:** The ADM IA will be primed with a comprehensive overview of the platform, including relationships between units and financial health.
- **Web Search Integration:** When explicitly requested, the AI will use the Tavily API to fetch external information.
- **Branch Resolution:** Automatic mapping of branch names to their parent matrices for contextual responses.

## Technical Details

### 1. Backend: AI Logic & Context
- **`src/lib/platform.server.ts`**:
    - Update `ADM_CHAT_SYSTEM` to include instructions for internal vs external search.
    - Add logic to resolve branch-to-matriz relationships in the prompt.
    - Enhance `PlatformSnapshot` to include more granular data if necessary.
- **`src/lib/tavily.server.ts`** (New File):
    - Implement `searchWeb(query: string)` function using the `TAVILY_API_KEY`.
    - Handle errors gracefully without exposing keys.
- **`src/lib/insights.functions.ts`**:
    - Update `askAgent` for ADM to check for "external search" intent.
    - If detected, call `searchWeb` and append results to the DeepSeek prompt.
    - Ensure strict separation of ADM context from other roles.

### 2. Frontend: UI & Interaction
- **`src/routes/_authenticated/dashboard.tsx`**:
    - Conditional rendering: Hide `AiAgentCard` from the main grid if `role === "adm"`.
- **`src/components/app/ai-agent-card.tsx`**:
    - Refactor `AdminAiAgentCard` to be a floating trigger (reuse mascot).
    - Implement the chat `Dialog` for ADM:
        - Title: "Gerente Operacional IA".
        - Initial Message: "Como posso te ajudar?".
        - No auto-calls on open.
        - Session-based history persistence.
    - Add logic to display search results/sources in `AiStructuredResponse`.

### 3. Intent Detection
- **`src/lib/ai-response-parser.ts`**:
    - Update `AiMarketingResponseSchema` to support search sources and link attributes.
- **Intent Logic**:
    - Backend check: If user query contains "pesquisar", "analisar site", "mercado", etc., trigger Tavily.

## Safety & Isolation
- **RLS**: No changes to RLS as `supabaseAdmin` is already used for platform snapshots.
- **Tenant Isolation**: ADM already has global read access; IA will respect these boundaries.
- **Banner/Matriz/Filial IA**: Byte-identical behavior for these roles; no regressions.

## Validation Plan
1. **Role Check:** Verify ADM sees the floating robot and NO fixed card.
2. **Internal Query:** Test "Qual matriz pertence à filial Padaria do Zé?"
3. **Comparison Query:** Test "A Filial Padaria do Zé está melhor que a matriz?"
4. **External Query:** Test "Analise o site www.exemplo.com e compare com a Manos Tech." (Verify Tavily call).
5. **UI Verification:** Check formatting, emojis, and "Short/Strategic" response tone.
6. **Quota Check:** Confirm ADM remains exempt from daily limits.
