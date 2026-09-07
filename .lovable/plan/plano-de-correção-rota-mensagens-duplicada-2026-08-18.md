# Plano de Correção: Rota `/mensagens` Duplicada

O objetivo é eliminar o conflito de rotas que está bloqueando o build do projeto, removendo o arquivo `.js` duplicado e garantindo que todas as melhorias estejam no arquivo `.tsx` oficial.

## Passos

1. **Investigar e Comparar**
   - Ler o conteúdo de `src/routes/_authenticated/mensagens.js` e `src/routes/_authenticated/mensagens.tsx`.
   - Identificar se existe alguma lógica, comentário ou estilo no arquivo `.js` que ainda não foi migrado para o `.tsx`.

2. **Migrar (se necessário)**
   - Caso existam alterações úteis no arquivo `.js`, aplicá-las em `src/routes/_authenticated/mensagens.tsx`.

3. **Remover Duplicidade**
   - Excluir o arquivo `src/routes/_authenticated/mensagens.js`.

4. **Validar**
   - Verificar se existe apenas uma declaração de rota para `/mensagens`.
   - Executar `npm run build`, `npm run typecheck` e `npm run lint` para garantir a integridade do projeto.

## Detalhes Técnicos

- A rota oficial deve ser `src/routes/_authenticated/mensagens.tsx`.
- O conflito ocorre porque o TanStack Router identifica ambos os arquivos como definidores da mesma rota.
- Nenhuma alteração funcional ou de banco de dados será realizada além da limpeza estrutural dos arquivos de rota.
