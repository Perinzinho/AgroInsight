# AgroInsight

## Rodar localmente (Node.js)

Requer Node.js **24.19.0 ou superior**. Na raiz do projeto, prepare as dependências e os dados:

```powershell
cd FrontEnd
npm.cmd ci
npm.cmd run data:build
```

No mesmo terminal, inicie a API:

```powershell
npm.cmd run api:dev
```

Em outro terminal, a partir da raiz do projeto, inicie a interface:

```powershell
cd FrontEnd
npm.cmd run dev -- --host 127.0.0.1 --port 5174 --strictPort
```

Abra **http://127.0.0.1:5174/**. Mantenha os dois terminais abertos; para parar, pressione `Ctrl+C` em cada um.

A análise por IA é opcional. Para configurá-la, veja o [guia do assistente](FrontEnd/docs/AI_ASSISTANT.md).

## Rodar com Docker

Na raiz do projeto:

```bash
docker compose up --build -d
```

Abra **http://localhost:5174/**. O Docker gera os dados e inicia o frontend e a API. A aplicação funciona sem chave; para habilitar a IA, configure `OPENAI_API_KEY` no `.env` da raiz e execute `docker compose up -d`.

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
