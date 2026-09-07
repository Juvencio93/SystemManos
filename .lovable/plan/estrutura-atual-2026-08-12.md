INTEGRAÇÃO UNIVERSAL DO PORTAL CATIVO — FASE 1

O Portal Cativo atual já possui a maioria dos campos obrigatórios (Nome, E-mail, WhatsApp, Cidade e Consentimento LGPD) e regras de isolamento (Matriz vs Filial). A Fase 1 foca em estruturar o sistema para suportar múltiplos fabricantes de hardware (MikroTik, RADIUS, etc.) através de um padrão de adaptadores.

### Estrutura Atual

- **Tabelas:** `visitors` (leads), `connections` (histórico de acessos), `companies` (Matriz), `branches` (Filiais).
- **Identificação:** O portal identifica a unidade através da `portal_slug` na URL. MAC e IP ainda não são capturados de forma estruturada dos parâmetros da URL (comum em hotspots).
- **Fluxo:** O cadastro salva o lead e a conexão, e então libera o acesso visualmente (redirecionando para a campanha).

### Estrutura Proposta (Nova)

Para suportar adaptadores universais, precisamos de:

1. **Tabela `hotspot_configs`:** Armazena as credenciais e configurações de integração por unidade (company/branch).
2. **Campos em `connections`:** Adicionar `mac_address`, `ip_address` e `ap_mac` para rastreamento técnico.
3. **Adaptador Universal:** Uma camada lógica que interpreta os parâmetros da URL (ex: `dst`, `mac`, `ip`, `link-login-only`) e executa a chamada de liberação específica do fabricante.

### Arquivos a serem alterados

1. `src/lib/portal.server.ts`: Para capturar MAC/IP e processar a liberação via adaptador.
2. `src/routes/portal.$slug.tsx`: Para ler parâmetros da URL e exibir estados de "Liberando...".
3. `src/lib/portal.functions.ts`: Para incluir a lógica de acionamento do adaptador no servidor.
4. **Novo:** `src/lib/adapters/index.ts` e `src/lib/adapters/mikrotik.ts`: Implementação inicial dos fabricantes.

### Funcionamento do Adaptador Universal

O sistema funcionará através de uma interface comum:

- **Identificação:** O Portal lê os parâmetros enviados pelo roteador na URL.
- **Autorização:** Após o cadastro, o servidor chama o adaptador correspondente à unidade.
- **Execução:** O adaptador MikroTik, por exemplo, fará um POST oculto para o endereço de login do roteador ou usará RADIUS.
- **Confirmação:** A internet só é considerada "liberada" após o retorno de sucesso do adaptador.

---

**Nenhuma alteração foi feita no banco de dados ou código ainda.** Aguardo sua aprovação da estrutura para prosseguir com a criação da migration e dos adaptadores.
