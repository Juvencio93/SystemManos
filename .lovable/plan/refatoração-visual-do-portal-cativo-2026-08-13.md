# Refatoração Visual do Portal Cativo

Objetivo: Modernizar a interface do portal cativo (rota pública) para todas as unidades, focando em mobile-first, mantendo a integridade das regras de negócio e infraestrutura.

## Componentes Visuais (src/routes/portal.$slug.tsx)

1. **Logo do Estabelecimento**
   - Remover containers/molduras.
   - Usar `object-contain` centralizado.
   - Fallback textual elegante caso não exista logo.

2. **Identificação da Operação**
   - Hierarquia: `trade_name > legal_name > name`.
   - Exibição de Cidade/Estado.
   - Frase comercial (`campaignDescription`) com tipografia refinada.

3. **Destaque da Campanha (BannerCarousel)**
   - Estilo promocional com selo "Oferta exclusiva no Wi-Fi".
   - Ajuste de `BannerCarousel` para suportar sobreposição de texto e gradientes se necessário.

4. **Formulário de Check-in**
   - Layout responsivo (1 coluna mobile, até 2 colunas desktop/tablet).
   - Campos com altura mínima de 48px.
   - WhatsApp com seletor de país integrado (mantendo lógica de DDI).
   - Validação visual clara com foco no erro e mensagens amigáveis.

5. **Consentimento LGPD**
   - Bloco discreto, porém legível, mantendo o checkbox obrigatório e o texto original.

6. **Botão Principal**
   - Texto: "Conectar ao Wi-Fi grátis".
   - Estilo full-width, ícone de Wi-Fi, estado de loading ("Conectando...").

7. **Assinatura**
   - Rodapé: "Tecnologia Manos Tech" (discreto).

## Detalhes Técnicos

- **Prioridade Mobile-First**: Testar em viewports de 320px, 375px e 768px.
- **Acessibilidade**: Foco visível, labels semânticas e alt text.
- **Restrição**: Nenhuma mudança em `portal.functions.ts`, `portal.server.ts` ou tabelas do banco.
- **Styles**: Uso de classes Tailwind existentes no projeto (`font-display`, `text-gradient`, `bg-card/85`, etc).

## Arquivos a serem modificados:

- `src/routes/portal.$slug.tsx`
- `src/components/app/banner-carousel.tsx`
