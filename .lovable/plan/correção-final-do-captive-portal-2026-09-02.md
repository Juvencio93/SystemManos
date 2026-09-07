# Correção final do Captive Portal

Corrigir os quatro estilos existentes sem alterar check-in, LGPD, carrossel, patrocinadores ou redirecionamento.

## Implementação

- Consolidar a identidade (logo, nome, localização e chamada) em um componente compartilhado entre prévia e portal público, eliminando diferenças de ordem e alinhamento.
- Garantir no mobile a ordem obrigatória: identidade, banner/indicadores, formulário/LGPD/botão e patrocinadores de eventos.
- Aplicar `logoPosition` ao bloco real da logo com alinhamento esquerdo, central e direito, preservando a posição após salvar e recarregar.
- Ajustar os quatro layouts para largura fluida, grid responsivo e espaçamentos/tipografia com `clamp()`, mantendo a composição utilizável em zoom 100% de 375px a 1920px e sem overflow horizontal.
- Remover da geração de tema cores decorativas externas à campanha. Cada estilo continuará visualmente distinto, mas superfícies, bordas, textos, foco, indicadores e botões serão derivados apenas das cores principal e de destaque, com neutros de contraste quando necessários.
- Fazer o botão habilitado usar a cor de destaque e o desabilitado usar uma mistura atenuada da mesma cor, ambos com contraste legível.

## Arquivos principais

- `src/lib/portal-theme.ts`
- `src/components/app/portal/portal-layouts.tsx`
- `src/components/app/campaign-portal-preview.tsx`
- `src/routes/portal.$slug.tsx`
- Se necessário para isolamento e reutilização, um pequeno componente visual compartilhado dentro de `src/components/app/portal/`.

## Validação

- Executar checagem TypeScript e testes aplicáveis.
- Validar visualmente os quatro estilos com `#141414` e `#eb0000` em 1366×768, 1920×1080, tablet, 375×667, 390×844 e 430×932.
- Validar logo à esquerda, centro e direita tanto na prévia quanto no portal público após recarregar.
- Conferir ordem mobile, ausência de overflow, contraste do botão, ausência de azul do sistema e console sem erros.
