# AgroInsight — FrontEnd

## Executar com Docker

Na **raiz do repositório**, execute `docker compose up --build -d` e abra **http://localhost:5174/**. O Compose inicia o frontend e a API juntos, sem precisar de Node/npm no computador. Veja o [guia do Docker](../docker/README.md).

## Assistente de análise agrícola

A aba **Recomendação (IA)** tem chat e **Indicadores por IA**, com prioridades, verificações sugeridas e evidências retornadas pelo modelo ao clicar em **Analisar período**. Permite escolher **Gemini**, **OpenRouter** ou a integração existente com **OpenAI**, e o modelo de cada provedor. A integração usa Node.js 24.19+ e chaves somente no backend. Sem provedor configurado ou sem resposta válida, os cartões de recomendações ficam vazios.

Veja [execução local, configuração, limites e builds](docs/AI_ASSISTANT.md) e o [registro de validação](docs/AI_VALIDATION.md). Comece com `npm.cmd ci`, copie `.env.example` para `.env`, configure a chave localmente e execute `data:build`, `api:dev` e `dev` em dois terminais, conforme o guia.

FrontEnd do AgroInsight, desenvolvido com React, TypeScript e Vite.

## Pré-requisitos

- Node.js 24.19.0 ou superior
- npm
- CSVs da base na raiz do repositório

## Como executar o projeto

O [README principal](../README.md#executar-localmente-no-windows) explica a configuração do `.env`, das chaves e dos modelos. Para preparar a execução local, dentro de `FrontEnd`:

```powershell
npm.cmd ci
if (!(Test-Path -LiteralPath .env)) { Copy-Item -LiteralPath .env.example -Destination .env }
# Configure as chaves no .env antes de iniciar a API.
npm.cmd run data:build
```

Inicie o backend em um terminal, dentro de `FrontEnd`:

```powershell
npm.cmd run api:dev
```

Em outro terminal, também dentro de `FrontEnd`, inicie o frontend:

```powershell
npm.cmd run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

Abra **http://127.0.0.1:5173/**. A API responde em **http://127.0.0.1:5175/api/ai/status**. Mantenha os dois terminais abertos e reinicie a API após alterar o `.env`; se mudar host ou porta da API, reinicie também o Vite.

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
