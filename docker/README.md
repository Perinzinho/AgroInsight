# Executar com Docker

Requisitos: Docker com suporte a containers Linux e Docker Compose **2.24 ou superior**. No Windows com WSL, execute os comandos no terminal que tem acesso ao Docker. Não é necessário instalar Node ou npm no computador.

Na raiz do repositório, onde está `compose.yaml`:

```bash
docker compose up --build -d
```

Abra **http://localhost:5174/** ou diretamente **http://localhost:5174/#/recomendacao-ia**. O primeiro build instala as dependências e gera os dados a partir dos CSVs da raiz. Aguarde a API ficar saudável para o serviço web iniciar.

## Configurar a IA (opcional)

A aplicação funciona sem chave, com os indicadores por regras. Para habilitar a análise por IA, crie ou edite `.env` **na raiz** com base em [`.env.example`](../.env.example), preenchendo `OPENAI_API_KEY` localmente. Se `.env` já existir, preserve os valores atuais.

O serviço da API lê `FrontEnd/.env` e depois `.env` da raiz; valores da raiz prevalecem. Os arquivos são opcionais. A chave entra apenas no ambiente da API durante a execução; arquivos `.env` são excluídos do contexto de build. Os limites `AI_*` estão descritos no [guia do assistente](../FrontEnd/docs/AI_ASSISTANT.md).

Depois de editar a configuração:

```bash
docker compose up -d
```

O Compose recria a API quando o ambiente muda. Não é necessário reconstruir a imagem para trocar a chave.

## Comandos úteis

```bash
# Estado dos serviços e verificações de saúde
docker compose ps

# Acompanhar os logs
docker compose logs -f

# Parar e remover os containers desta aplicação
docker compose down

# Reconstruir após alterações no código ou nos CSVs
docker compose up --build -d
```

Se a porta 5174 estiver ocupada, defina `AGROINSIGHT_PORT=5180` no `.env` da raiz, execute `docker compose up -d` e abra `http://localhost:5180/`.

## Verificação da integração

Com os dois serviços iniciados, execute no zsh/bash/WSL, a partir da raiz:

```bash
docker compose exec -T api node --input-type=module < docker/smoke.mjs
```

O roteiro verifica a interface compilada, arquivos estáticos, manifesto, proxy, host/origem, tamanho da requisição e versão da base. Sem chave, verifica também `AI_NOT_CONFIGURED`. Não chama o provedor de IA, mesmo quando houver uma chave configurada.

## Organização

O [Dockerfile](../Dockerfile) gera os bundles do frontend e da API em uma etapa compartilhada. A imagem da API usa Node 24, dependências de produção, execução com usuário `node` e o snapshot gerado. A imagem web usa Nginx e os arquivos de `dist/`.

A API escuta `0.0.0.0:5175` dentro da rede Docker e não publica porta no computador. O Nginx encaminha `/api/` para a API, preservando host e origem para as validações existentes. O único acesso publicado pelo Compose é `127.0.0.1:5174`; esta configuração destina-se ao uso local. [Referência de portas e dependências do Compose](https://docs.docker.com/reference/compose-file/services/).
