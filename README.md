# AgroInsight

## Executar localmente no Windows

Requisitos: **Node.js 24.19.0 ou superior**, npm e os arquivos CSV mantidos na raiz do repositório. Os comandos abaixo usam PowerShell e partem da raiz do projeto.

A API/backend está em [`FrontEnd/server`](FrontEnd/server), e a interface está em [`FrontEnd/src`](FrontEnd/src). Os dois processos usam as dependências e os scripts de `FrontEnd/package.json`.

### 1. Instalar as dependências e criar o `.env`

```powershell
cd FrontEnd
npm.cmd ci
if (!(Test-Path -LiteralPath .env)) { Copy-Item -LiteralPath .env.example -Destination .env }
```

Edite **`FrontEnd/.env`** com as suas configurações. Se ele já existir, preserve as chaves e os valores atuais. O arquivo [`.env.example`](FrontEnd/.env.example) serve como modelo; as chaves reais ficam apenas no `.env`, que não deve ser enviado ao Git nem colocado em variáveis `VITE_*`.

Exemplo para usar Gemini:

```dotenv
AI_PROVIDER=gemini
GEMINI_API_KEY=cole_sua_chave_aqui
GEMINI_MODEL=gemini-3.5-flash-lite
GEMINI_MODELS=gemini-3.5-flash-lite,gemini-3.8-flash

AI_HOST=127.0.0.1
AI_PORT=5175
AI_TIMEOUT_MS=60000
AI_DATA_DIR=./public/data
```

Para usar OpenRouter, preencha também estas variáveis e use `AI_PROVIDER=openrouter` caso queira esse provedor como padrão:

```dotenv
OPENROUTER_API_KEY=cole_sua_chave_aqui
OPENROUTER_MODEL=google/gemini-2.5-flash
OPENROUTER_MODELS=google/gemini-2.5-flash,openai/gpt-4.1-mini
```

Configure a chave dos provedores que pretende utilizar; as outras podem ficar vazias. `AI_PROVIDER` define a seleção inicial, e a aba **Recomendação (IA)** permite escolher outro provedor configurado e o modelo. As listas `*_MODELS` são separadas por vírgulas e devem conter modelos disponíveis na sua conta. A integração existente com `OPENAI_API_KEY`, `OPENAI_MODEL` e `OPENAI_MODELS` também é aceita.

Os demais limites podem permanecer como no exemplo. `AI_TIMEOUT_MS` é o tempo máximo da análise em milissegundos: `60000` corresponde a um minuto e `120000` a dois minutos. Sem chave, os painéis de dados funcionam, mas a geração de indicadores e recomendações por IA fica indisponível.

### 2. Gerar os dados locais

Ainda dentro de `FrontEnd`:

```powershell
npm.cmd run data:build
```

Esse comando converte os CSVs da raiz em JSONs em `FrontEnd/public/data`. Execute-o na primeira instalação e depois de atualizar os CSVs. Após gerar uma nova versão, recarregue os dados na interface.

### 3. Iniciar a API/backend — terminal 1

Abra um terminal na raiz do projeto:

```powershell
cd FrontEnd
npm.cmd run api:dev
```

Mantenha esse terminal aberto. A API fica em **http://127.0.0.1:5175**. Para conferir sua disponibilidade, abra **http://127.0.0.1:5175/api/ai/status**: `dataReady: true` indica que a base está pronta, e `configured: true` indica que há um provedor com chave configurada. Essa consulta não chama o modelo nem verifica saldo ou permissões da chave.

### 4. Iniciar o frontend — terminal 2

Abra **outro terminal** na raiz do projeto:

```powershell
cd FrontEnd
npm.cmd run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

Abra **http://127.0.0.1:5173/**. Para acessar diretamente o assistente, use **http://127.0.0.1:5173/#/recomendacao-ia**, selecione provedor/modelo e clique em **Analisar período** ou envie uma pergunta. Cada análise pode consumir a cota da API do provedor escolhido.

O frontend encaminha as chamadas de `/api/ai` para o backend. **Os dois terminais precisam permanecer em execução** para usar a IA. Para encerrar cada processo, pressione `Ctrl+C` no respectivo terminal.

### Alterações de configuração e problemas comuns

- **Mudou o `.env`:** reinicie a API com `Ctrl+C` e `npm.cmd run api:dev`. Se alterar `AI_HOST` ou `AI_PORT`, reinicie também o frontend.
- **“A API local está indisponível”:** confira se o terminal do backend está rodando, consulte `/api/ai/status` e clique em **Verificar disponibilidade** na interface.
- **Base indisponível:** execute `npm.cmd run data:build` antes de iniciar uma análise.
- **Porta ocupada:** confira se esta aplicação já está rodando. Para mudar a porta do frontend, altere `--port 5173` no comando; para a API, altere `AI_PORT` no `.env`. As portas `4200` e `8000` são reservadas e não são aceitas pela API.

Veja os [detalhes da integração, limites e builds](FrontEnd/docs/AI_ASSISTANT.md).

## Rodar com Docker

Como alternativa aos dois terminais locais, use Docker com Compose. Na raiz do projeto, crie o `.env` a partir do exemplo, se ainda não existir:

```powershell
if (!(Test-Path -LiteralPath .env)) { Copy-Item -LiteralPath .env.example -Destination .env }
```

Preencha `GEMINI_API_KEY` ou `OPENROUTER_API_KEY` nesse **`.env` da raiz** e ajuste os modelos conforme os exemplos acima. Depois execute, também na raiz:

```bash
docker compose up --build -d
```

Abra **http://localhost:5174/**. O Docker gera os dados e inicia o frontend e a API juntos. O Compose lê `FrontEnd/.env` e depois o `.env` da raiz; os valores da raiz prevalecem, inclusive quando vazios. Após alterar variáveis de ambiente, recrie o serviço da API com `docker compose up -d --force-recreate api`.

Veja [configuração, logs, portas e verificação](docker/README.md). Para parar: `docker compose down`.

## Anotações da equipe

Header e footer - com exportação de pdf tem que implemnetar a biblioteca quem for fazer e o footer so colocar nossos git via link (Thiago)

campo de texto (random) (Noah)

quadrados do resumo da safra (Noah)

Retangulos da evidência que merece investigação (Gustavo)

Recomendações (fim da página também) (Gustavo)

gráfico de linha balanço hídrico
(Joaquim)


gráfico de pizza (insetos e operação) (perin)

gráfico de barra (temperatura e chuva)   --- falta decidir
