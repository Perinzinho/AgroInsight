---
name: AgroInsight
description: Monitoramento agrícola com clareza, contexto e proximidade do campo.
colors:
  forest: "#173f35"
  green: "#2a6b4b"
  green-dark: "#194933"
  sage: "#e8efdf"
  sage-text: "#364c35"
  yellow: "#bc914d"
  yellow-dark: "#8e6b31"
  blue: "#4c8190"
  blue-dark: "#315e6d"
  danger: "#bd5c43"
  page: "#f4f6f3"
  surface: "#ffffff"
  surface-elevated: "#edf1ec"
  text-primary: "#1e352b"
  text-secondary: "#5e6e64"
  text-muted: "#647369"
  border: "#dce3da"
  border-strong: "#c5d0c3"
  overlay-green: "rgba(42, 107, 75, 0.10)"
  overlay-blue: "rgba(76, 129, 144, 0.10)"
  overlay-yellow: "rgba(188, 145, 77, 0.12)"
  overlay-red: "rgba(189, 92, 67, 0.10)"
typography:
  display:
    fontFamily: "Manrope, sans-serif"
    fontSize: "clamp(29px, 3.1vw, 44px)"
    fontWeight: 650
    letterSpacing: "-.035em"
    lineHeight: 1.2
  headline:
    fontFamily: "Manrope, sans-serif"
    fontSize: "clamp(28px, 2.8vw, 38px)"
    fontWeight: 750
    letterSpacing: "-.035em"
    lineHeight: 1.2
  title:
    fontFamily: "Manrope, sans-serif"
    fontSize: "18px"
    fontWeight: 750
    letterSpacing: "-.025em"
    lineHeight: 1.4
  body:
    fontFamily: "Manrope, sans-serif"
    fontSize: "13px"
    lineHeight: 1.8
  label:
    fontFamily: "Manrope, sans-serif"
    fontSize: "12px"
    fontWeight: 550
    lineHeight: 1.5
  metric:
    fontFamily: "Manrope, sans-serif"
    fontSize: "clamp(30px, 3vw, 38px)"
    fontWeight: 650
    letterSpacing: "-.035em"
    lineHeight: 1.15
rounded:
  badge: "5px"
  chip: "6px"
  action: "7px"
  control: "8px"
  popover: "10px"
  indicator: "14px"
  surface: "16px"
spacing:
  tight: "4px"
  control: "8px"
  inline: "12px"
  group: "16px"
  compact-panel: "20px"
  panel: "24px"
  section: "28px"
components:
  field-action:
    backgroundColor: "#e5efd6"
    textColor: "#1c3e2b"
    rounded: "{rounded.action}"
    padding: "10px 14px"
  search-input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.control}"
    padding: "7px 9px"
  navigation:
    textColor: "#d4e1d6"
    rounded: "{rounded.control}"
    padding: "11px 13px"
  period-chip:
    backgroundColor: "{colors.forest}"
    textColor: "{colors.surface}"
    rounded: "{rounded.chip}"
    padding: "6px 13px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.surface}"
    padding: "24px"
  weather:
    backgroundColor: "{colors.sage}"
    textColor: "{colors.sage-text}"
    rounded: "{rounded.surface}"
    padding: "22px 23px 17px"
---

# Design System: AgroInsight

## Overview

**Creative North Star: "O campo, de perto"**

Uma interface de monitoramento agrícola serena, concreta e próxima do território. A navegação verde floresta enquadra um espaço claro de análise; Manrope, ícones de contorno e tons de sálvia dão identidade sem competir com os registros.

A fotografia panorâmica traz o campo para a visão geral. É uma paisagem ilustrativa, identificada como tal, e não representa a propriedade dos dados. Nas análises, o espaço pertence a filtros, séries, contagens e explicações de cobertura. A expressão visual acompanha a linguagem em português e a distinção entre ausência de dado e zero.

**Key Characteristics:**
- Verde floresta na navegação, superfícies claras na análise.
- Tipografia Manrope local e números tabulares.
- Fotografia real identificada como ilustração.
- Bordas finas, superfícies tonais e movimento breve ligado à interação.

## Colors

Verdes naturais sustentam a identidade; azul, ocre e terracota distinguem contexto e severidade. Os valores normativos estão no frontmatter e correspondem às variáveis de `FrontEnd/src/index.css`; a paleta de dados também está em `FrontEnd/src/core/theme/colors.ts`.

### Primary
- **Floresta** (`forest`): base da navegação e do período selecionado.
- **Verde de campo** (`green`, `green-dark`): links, foco, linhas do gráfico e estados positivos; o tom escuro sustenta texto sobre fundos claros.

### Secondary
- **Sálvia** (`sage`, `sage-text`): painel climático e resposta de controles ao ponteiro.
- **Água** (`blue`, `blue-dark`) e **ocre** (`yellow`, `yellow-dark`): contexto climático, avisos e categorias de informação.
- **Terracota** (`danger`): ocorrências críticas, acompanhadas de texto explícito.

### Neutral
- **Tela fria** (`page`), **branco** (`surface`) e **verde muito claro** (`surface-elevated`): canvas, painéis e controles.
- **Tinta vegetal** (`text-primary`, `text-secondary`, `text-muted`): hierarquia de leitura.
- **Divisórias vegetais** (`border`, `border-strong`): agrupamentos, tabelas e campos.
- As quatro cores `overlay-*` dão fundos transparentes aos badges e avisos sem substituir a semântica textual.

**The Contexto Rule.** Cor de severidade sempre acompanha um rótulo; não representa sozinha a conclusão sobre o dado.

## Typography

**Display Font:** Manrope, com fallback sans-serif.
**Body Font:** Manrope, com fallback sans-serif.

A família variável é servida de `FrontEnd/public/fonts/Manrope-Variable.ttf`, com licença local. Pesos intermediários diferenciam títulos, medidas e controles sem introduzir outra voz tipográfica.

- **Display:** chamada da paisagem na visão geral; segue `typography.display`.
- **Headline:** título de rota; segue `typography.headline`.
- **Title:** título de painel; a visão geral usa uma variação de 17px, reduzida a 15px no celular.
- **Body:** subtítulos de painel, com medida máxima de 75ch; descrições de rota usam 14px e entrelinha 1.8.
- **Label:** rótulos dos indicadores e controles. Textos auxiliares variam entre 10–12px.
- **Metric:** contagens com numerais tabulares; não usar fonte monoespaçada para criar aparência técnica.

## Layout

O shell tem navegação lateral fixa no fluxo por `sticky`, largura de 248px e conteúdo fluido. O miolo tem limite de 1600px e respiro horizontal fluido entre 24–46px. No desktop intermediário a lateral ocupa 220px; a partir de 1700px ocupa 272px.

A tela de Operações exibe sempre todas as ordens de serviço da base, sem seletor de período. As demais telas mantêm o período compartilhado.

A visão geral começa com panorama e título, período compartilhado, uma faixa de três indicadores, gráfico com clima e investigação das armadilhas. A faixa usa divisórias internas, sem transformar cada indicador em uma pilha de cartões. O gráfico e o clima usam colunas `1fr / .48fr`, com intervalo de 20px.

Até 1000px, clima e gráfico se empilham. Até 760px a lateral vira cabeçalho com menu expansível em duas colunas. Até 600px os indicadores viram linhas, os filtros ocupam a largura e a tabela incorpora a praga ao nome da armadilha. Até 380px o miolo reduz o respiro lateral para 14px. A largura mínima do documento é 320px.

## Elevation & Depth

Painéis repousam sobre bordas finas ou contraste tonal, sem sombra ambiente. A paisagem recebe gradiente escuro direcional para legibilidade. Sombras pequenas identificam seleção: controle segmentado (`0 1px 4px rgba(30,55,43,.09)`) e período (`0 2px 4px rgba(23,63,53,.12)`). O painel do seletor múltiplo usa elevação funcional (`0 8px 24px rgba(30, 53, 43, 0.14)`).

**The Repouso Rule.** Superfícies de análise permanecem estáveis; elevação pertence a seleção e sobreposição.

## Shapes

Superfícies amplas usam cantos suaves de 14–16px. Controles usam 6–8px; badges compactos usam 5px. Os contornos são finos, normalmente de 1px. Círculos são reservados a ícones utilitários, indicadores pequenos e carregamento.

## Components

- **Ação da paisagem:** link claro e compacto com seta diagonal; ao passar o ponteiro o espaço entre texto e seta cresce e o fundo fica branco.
- **Período e controle segmentado:** botões com `aria-pressed`, seleção evidente e transição de cor de 200ms. O período indisponível reduz opacidade e bloqueia interação.
- **Busca e seleção:** campo claro, borda vegetal e foco verde escuro. O seletor múltiplo possui busca, limpar seleção e estado sem resultados.
- **Navegação:** links com SVG de traço 1.6, seleção em verde claro e `aria-current`. Menu móvel usa `aria-expanded`, fecha ao navegar e devolve foco ao botão quando fechado com Escape.
- **Painéis e clima:** painel branco com cabeçalho e corpo; clima em sálvia, valores alinhados e unidades menores. A tabela mantém números à direita e fornece ações de investigação identificadas.
- **Dados e avisos:** carregamento textual com spinner; erro com ação “Tentar de novo”; vazio com explicação e recuperação. Dado ausente usa travessão. O gráfico começa em zero e mantém lacunas para valores ausentes.

A entrada da paisagem combina acomodação da foto (1.2s) e deslocamento curto do texto (800ms), com `cubic-bezier(.16, 1, .3, 1)`. Mudança de rota usa fade de 350ms; substituição de número usa blur breve de 300ms. Setas respondem à ação do usuário. `prefers-reduced-motion` reduz transições e animações CSS, desativa rolagem suave e desliga animação do gráfico. Foco visível usa contorno de 2px e offset de 2px; na navegação escura o contorno é claro. Seleção de texto, caret e scrollbar seguem a paleta.

## Do's and Don'ts

### Do:
- **Do** manter a leitura em português, com números tabulares e unidades explícitas.
- **Do** usar fotografia real com origem registrada e indicação de uso ilustrativo.
- **Do** preservar lacunas, avisos de cobertura e ações de recuperação junto dos dados.
- **Do** manter foco visível e respeitar a preferência por movimento reduzido.

### Don't:
- **Don't** trocar dados ausentes por zero ou desenhar continuidade nas lacunas do gráfico.
- **Don't** usar emoji como substituto do sistema de ícones SVG.
- **Don't** aplicar sombra decorativa em todos os painéis ou repetir a paisagem em cada rota.
- **Don't** apresentar recomendações como diagnóstico agronômico.
