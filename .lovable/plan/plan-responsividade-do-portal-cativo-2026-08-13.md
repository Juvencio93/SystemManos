# Plan: Responsividade do Portal Cativo

Aprimorar o layout do portal cativo para ser mobile-first, compacto em telas pequenas e eficiente em duas colunas em telas grandes, preservando toda a lógica de negócio e identidade visual.

## User Review Required

> [!IMPORTANT]
> A implementação focará exclusivamente no arquivo `src/routes/portal.$slug.tsx`. A lógica de banners (16:9) já está implementada no componente `BannerCarousel`, que será mantido.

- **Layout Mobile**: A logo será reduzida em ~20% e os espaços verticais serão otimizados para evitar rolagem excessiva.
- **Layout Desktop**: A partir de 1024px, o conteúdo será dividido em duas colunas (Esquerda: Info + Banner; Direita: Formulário + Botão).
- **Assinatura**: O rodapé "Tecnologia Manos Tech" será centralizado abaixo das duas colunas no desktop.

## Technical Details

### Frontend Changes

#### `src/routes/portal.$slug.tsx`

- Refatorar o `PortalShell` para aceitar uma largura máxima dinâmica ou ajustar seu container interno.
- No `PortalPage`, introduzir um wrapper flex/grid que alterna entre 1 coluna (mobile/tablet vertical) e 2 colunas (desktop/tablet horizontal).
- Ajustar classes do Tailwind:
  - Logo: `max-h-[80px]` no mobile, `max-h-[100px]` no desktop.
  - Spacing: Reduzir `mb-8` para `mb-4` ou `mb-6` em elementos de cabeçalho no mobile.
  - Form: Ajustar `p-6 sm:p-8` para `p-5 md:p-8`.
  - Grid: `grid-cols-1 lg:grid-cols-2` com `gap-8` e `items-start`.
- Garantir que a assinatura do rodapé fique fora do wrapper de duas colunas para permanecer centralizada na largura total.

### Validation Plan

- Executar Playwright para capturar screenshots em:
  - **320px / 375px**: Validar compactação e altura dos campos.
  - **768px**: Validar layout tablet (1 ou 2 colunas dependendo da largura).
  - **1024px / 1280px**: Validar o novo layout de duas colunas alinhadas pelo topo.
- Auditar visualmente a logo (`object-contain`) e o banner (16:9).
- Verificar se o build e o TypeScript continuam passando.
