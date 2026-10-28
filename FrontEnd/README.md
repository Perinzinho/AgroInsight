# AgroInsight — FrontEnd

## Executar com Docker

Na **raiz do repositório**, execute `docker compose up --build -d` e abra **http://localhost:5174/**. O Compose inicia o frontend e a API juntos, sem precisar de Node/npm no computador. Veja o [guia do Docker](../docker/README.md).

## Assistente de análise agrícola

A aba **Recomendação (IA)** tem chat com ferramentas de consulta e evidências, além dos indicadores por regras disponíveis sem API. A integração usa Node.js 24.19+, Responses API e chave somente no backend.

Veja [execução local, configuração, limites e builds](docs/AI_ASSISTANT.md) e o [registro de validação](docs/AI_VALIDATION.md). Comece com `npm.cmd ci`, copie `.env.example` para `.env`, configure a chave localmente e execute `data:build`, `api:dev` e `dev` em dois terminais, conforme o guia.

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
