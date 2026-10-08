# Matriz de permissões do sistema

Revisão técnica: 7 de outubro de 2026.

## Regra geral

| Perfil | Alcance permitido | Restrições obrigatórias |
|---|---|---|
| ADM | Toda a plataforma | Acesso reservado à equipe Manos Tech; ações administrativas devem ser auditáveis. |
| Revenda | Empresas pertencentes à própria revenda | Não acessa empresas de outra revenda nem configurações globais da plataforma. |
| Matriz | A própria empresa e suas filiais | Não acessa dados de outra empresa ou configurações globais. |
| Filial | A própria unidade | Não acessa outras filiais, mesmo que pertençam à mesma matriz. |

## Resultado da auditoria

- Todos os 5 usuários matriz existentes possuem `company_id`.
- O usuário filial existente possui `company_id` e `branch_id`.
- Os 2 usuários revenda existentes possuem `reseller_id`.
- O usuário ADM não está associado a empresa, filial ou revenda, conforme o desenho global.
- As tabelas centrais de empresas, filiais, campanhas, visitantes, conexões e dispositivos HotSpot usam RLS com escopo por perfil.
- As tabelas com segredos de PagBank, Telegram e handoff do portal ficam sem acesso direto para `anon` e `authenticated`; somente o servidor usa `service_role`.

## Correções preparadas

1. Impedir que `has_role` seja usada por um usuário comum para consultar o papel de outra conta.
2. Corrigir a ordem dos parâmetros de `check_participant_access` e limitar a verificação à própria conta, salvo ADM.
3. Manter funções `SECURITY DEFINER` exigidas pelas políticas com `search_path` fixo e permissões explícitas.
4. Criar os índices de chaves estrangeiras apontados pelo consultor do Supabase.
5. Remover uma restrição única duplicada em cobranças.

## Teste de regressão por perfil

Antes de publicar uma alteração de permissão, validar com uma conta de cada perfil:

1. ADM abre empresas, revendas, privacidade e configurações globais.
2. Revenda vê somente empresas vinculadas ao seu `reseller_id`.
3. Matriz vê somente a própria empresa, suas filiais e seus dados operacionais.
4. Filial vê somente a própria unidade.
5. Cada perfil tenta abrir por URL e por requisição um registro de outro escopo; o resultado esperado é acesso negado ou lista vazia.
6. Usuário não autenticado não acessa nenhuma rota interna nem tabela administrativa.

## Pontos de atenção

O consultor do Supabase informa funções `SECURITY DEFINER` executáveis por usuários autenticados. Parte delas é necessária para RLS, chat e controle de consumo. Esse alerta não deve ser eliminado revogando permissões indiscriminadamente, pois isso interromperia as políticas. Cada função deve validar `auth.uid()`, conferir o escopo e usar `search_path` fixo.
