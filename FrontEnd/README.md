# AgroInsight — FrontEnd

FrontEnd do AgroInsight, desenvolvido com React, TypeScript e Vite.

## Pré-requisitos

- Node.js (versão LTS recomendada)
- npm

## Como executar o projeto

No diretório `FrontEnd`, instale as dependências:

```bash
npm install
```

Em seguida, inicie o ambiente de desenvolvimento:

```bash
npm run dev
```

O Vite exibirá no terminal o endereço local para abrir a aplicação no navegador.

## Comandos disponíveis

```bash
# Inicia o servidor de desenvolvimento
npm run dev

# Gera a versão de produção
npm run build

# Executa a análise de código
npm run lint

# Visualiza localmente a versão de produção
npm run preview
```

## Organização do código

```text
src/
├── core/       # Componentes e recursos reutilizáveis em toda a aplicação
├── feature/    # Componentes específicos de cada tela ou funcionalidade
└── assets/     # Imagens e demais arquivos estáticos
```

### `core`

O diretório `core` reúne abstrações reutilizáveis: componentes base, estilos, tema e elementos visuais compartilhados. Ele não deve depender de uma tela específica.

### `feature`

O diretório `feature` contém componentes próprios de cada tela ou funcionalidade. Esses componentes podem compor e utilizar elementos do `core`, mas representam regras e interfaces específicas daquela área do sistema.

## Tema de cores

As cores padrão do projeto estão centralizadas em `src/core/theme/colors.ts`. Use esse arquivo diretamente ao criar ou estilizar componentes, evitando declarar valores hexadecimais repetidos pela aplicação.

```ts
import { colors } from '../core/theme/colors'

const corPrincipal = colors.green.primary
const corInformativa = colors.blue.primary
const corDeAlerta = colors.yellow.primary
```

A paleta segue a identidade visual do AgroInsight, com azul, verde e amarelo, além de cores para fundo, texto, bordas e mensagens de feedback.
