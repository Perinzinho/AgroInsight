# Assistente de análise local

A rota `#/recomendacao-ia` oferece uma interface de conversa com o **Assistente de campo**. A caixa de pergunta reúne os seletores de provedor e modelo, envio por Enter e cancelamento. **Nova conversa** limpa o histórico e o rascunho. As seis verificações determinísticas continuam em **Indicadores por regras**, recolhidos por padrão.

Esta tela não tem seletor de dias: o assistente usa todo o intervalo disponível da propriedade, sem herdar filtros de período, armadilhas ou pragas de outras telas. A cobertura aparece no rodapé e nas fontes das respostas. A janela continua sujeita ao limite de 366 dias da API. O modelo só é chamado após **Analisar propriedade**, **Enviar**, clique numa sugestão ou nova tentativa explícita. Consultar status e atualizar o catálogo não geram análises. Sem chave, é possível preparar um rascunho; o envio permanece bloqueado.

## Escolher o provedor e o modelo

A interface permite escolher **Gemini** ou **OpenRouter** e um modelo do catálogo. Configure `GEMINI_API_KEY` e/ou `OPENROUTER_API_KEY` apenas no servidor. `AI_DEFAULT_PROVIDER` define a preferência inicial; se não estiver configurado, o servidor prefere outro provedor com chave. OpenAI permanece como opção quando `OPENAI_API_KEY` estiver configurada.

O endpoint `GET /api/ai/models?provider=gemini` (ou `openrouter`) consulta somente metadados, sem gerar respostas. O backend usa as APIs oficiais com cache de cinco minutos. No Gemini, lista modelos de geração de texto, excluindo variantes dedicadas a imagem, áudio e outras modalidades. No OpenRouter, inclui modelos com saída de texto, mesmo sem suporte a ferramentas. O catálogo não garante acesso, saldo ou compatibilidade de todas as opções de cada modelo; falhas são tratadas sem trocar de provedor/modelo silenciosamente. **Atualizar modelos** repete a leitura de metadados, respeitando o cache. Sem chave, exibe somente o modelo padrão configurado e bloqueia análises.

Trocar provedor ou modelo cancela a análise pendente e inicia outra conversa. Cada envio congela `selection: { provider, model }`; o backend rejeita modelos fora do catálogo e devolve a seleção efetivamente usada. A interface rejeita respostas com seleção divergente e mostra o provedor/modelo junto da análise. As escolhas e conversas ficam na memória da página.

Gemini, OpenRouter e OpenAI usam seus endpoints de Chat Completions. O modelo recebe um dossiê compacto calculado pelo backend e responde em texto JSON. Não precisa suportar function calling, ferramentas ou Structured Outputs. O adaptador evita parâmetros opcionais como temperatura, schema nativo e roteamento obrigatório por ferramentas. A seleção de provedor/modelo permanece explícita; erros não provocam troca silenciosa.

O backend remove cercas de markdown e aceita um invólucro `answer`. Listas de apresentação omitidas (`limitations` e `followUpQuestions`) são normalizadas para listas vazias; valores, prioridades, ações e referências não são inventados ou completados. O schema completo e os IDs de evidência continuam sendo validados localmente. No máximo uma nova geração é permitida para corrigir JSON, limites de formato, referências inexistentes, saída truncada ou uma investigação que ignore os sinais disponíveis. Falhas de rede, autenticação e cota não têm retry automático.

Isso amplia a compatibilidade com modelos de chat dos três provedores; não garante a mesma qualidade em todos os modelos. Modelos precisam compreender as instruções e produzir JSON no limite de saída configurado. Modelos dedicados a áudio/imagem são excluídos do catálogo quando identificados. A listagem não garante acesso, saldo ou disponibilidade para geração.

Referências oficiais: [compatibilidade do Gemini](https://ai.google.dev/gemini-api/docs/openai), [Structured Outputs e JSON na OpenAI](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=chat), [parâmetros do OpenRouter](https://openrouter.ai/docs/guides/routing/provider-selection) e [catálogo OpenRouter](https://openrouter.ai/docs/api/api-reference/models/list-all-models-and-their-properties).

Para iniciar frontend e API juntos com containers, execute `docker compose up --build -d` na raiz do repositório. Veja o [guia do Docker](../../docker/README.md).

## Executar do zero no Windows

Requisitos: Node.js **24.19.0 ou superior**, npm e os CSVs da raiz do repositório. No PowerShell, use `npm.cmd`.

```powershell
cd FrontEnd
npm.cmd ci
Copy-Item .env.example .env
```

Preencha `GEMINI_API_KEY` e/ou `OPENROUTER_API_KEY` em `.env` localmente, ou defina as variáveis no ambiente do servidor. Não envie chaves ao chat, Git, `public/` ou variáveis `VITE_*`. Sem chave do provedor selecionado, a API informa `AI_NOT_CONFIGURED`; os indicadores por regras continuam funcionando.

Gere os dados antes de iniciar qualquer análise:

```powershell
npm.cmd run data:build
Get-NetTCPConnection -State Listen -LocalPort 5174,5175 -ErrorAction SilentlyContinue
npm.cmd run api:dev
```

Se houver saída na verificação de portas, identifique o serviço e configure uma porta livre. Não encerre processos de outros projetos. As portas 4200 e 8000 são reservadas e a API as rejeita. A API falha claramente com porta ocupada; não muda de porta automaticamente.

Em outro terminal:

```powershell
cd FrontEnd
npm.cmd run dev -- --host 127.0.0.1 --port 5174 --strictPort
```

Abra `http://127.0.0.1:5174/#/recomendacao-ia`. Configure a chave antes de iniciar a API; se mudar `.env`, reinicie a API. O frontend usa `/api/ai` pelo proxy Vite; reinicie o Vite se mudar host/porta.

## Configuração do servidor

`.env` é lido de `FrontEnd/`, independentemente do diretório atual do terminal. Variáveis já definidas no processo prevalecem. `.env.example` contém os valores iniciais. `AI_DATA_DIR` é resolvido contra **FrontEnd**, tanto em `tsx` quanto em `dist-server/index.js`; caminhos absolutos administrativos também são aceitos. Clientes e ferramentas nunca escolhem arquivos ou diretórios.

| Variável | Padrão | Uso |
| --- | --- | --- |
| `AI_DEFAULT_PROVIDER` | `gemini` | Preferência inicial: `gemini`, `openrouter` ou `openai` |
| `GEMINI_API_KEY` | vazio | Chave Google apenas no servidor |
| `GEMINI_MODEL` | `gemini-3.8-flash` | Modelo inicial; se ausente do catálogo, usa a primeira opção disponível |
| `OPENROUTER_API_KEY` | vazio | Chave OpenRouter apenas no servidor |
| `OPENROUTER_MODEL` | `openai/gpt-4.1-mini` | Modelo inicial no formato `provedor/modelo` |
| `OPENAI_API_KEY` | vazio | Chave apenas no servidor |
| `OPENAI_MODEL` | `gpt-4.1-mini` | Modelo de chat com saída de texto JSON |
| `AI_HOST` | `127.0.0.1` | `127.0.0.1`, `localhost`, `::1` ou `0.0.0.0` para a rede do container; no Compose, somente o proxy web publica uma porta local |
| `AI_PORT` | `5175` | Porta da API e destino do proxy |
| `AI_TIMEOUT_MS` | `60000` | Tempo total do turno, incluindo leitura dos dados |
| `AI_MAX_OUTPUT_TOKENS` | `2000` | Saída máxima por chamada |
| `AI_MAX_INPUT_TOKENS` | `12000` | Orçamento de contexto por chamada |
| `AI_MAX_TOOL_ROUNDS` | `4` | Legado, sem efeito no fluxo com dossiê |
| `AI_MAX_TOOL_CALLS` | `8` | Legado, sem efeito no fluxo com dossiê |
| `AI_MAX_PROVIDER_CALLS` | `2` | Teto de chamadas; o fluxo limita a duas (geração e eventual correção) |
| `AI_RATE_LIMIT_PER_MINUTE` | `10` | Turnos por IP local por minuto |
| `AI_MAX_CONCURRENT_REQUESTS` | `2` | Turnos simultâneos no servidor |
| `AI_DATA_DIR` | `./public/data` | Diretório administrativo do snapshot |

Todos os números são inteiros positivos com tetos validados em `server/config.ts`. Pergunta: até 2.000 caracteres. Histórico: até 12 mensagens de usuário/assistente e 12.000 caracteres. Corpo: até 64 KiB. Período: datas reais, inclusivas, até 366 dias. IDs desconhecidos, campos extras e papéis privilegiados são rejeitados antes do provedor.

## Economia de tokens e fluxo de evidências

O backend lê e valida os dez JSONs base do disco. Reutiliza um snapshot completo em memória e verifica metadados dos arquivos antes de reutilizá-lo. Uma atualização só substitui o snapshot após validação completa e conferência de estabilidade durante a leitura. Não regenere dados enquanto uma análise estiver em andamento.

Antes de chamar o modelo, o backend executa cinco leituras locais determinísticas: pragas, clima, fertilização, pulverização e alertas de máquina. Usa os seletores, limiares e indicadores por regras existentes, sem depender de o modelo escolher consultas. O dossiê inclui:

- Filtros, dia local atual, versão, unidades, fontes e cobertura real de cada domínio.
- Totais de capturas, ranking de pragas e amostra de avaliações diárias com limites e avisos preservados.
- Chuva, evapotranspiração, saldo hídrico, dias com saldo negativo, temperaturas e lacunas.
- OS selecionadas, trechos abaixo da dose configurada, pressão zero/ausente e escopo dos totais completos.
- Alertas de máquina, classificação e raio de referência; sinais prioritários com verificações práticas.
- Sobreposição de datas entre operações e pragas e declaração explícita dos dados indisponíveis, como produtividade.

Perguntas específicas selecionam sinais e detalhes do assunto; perguntas amplas recebem os domínios disponíveis. Seguimentos curtos também consideram o último assunto do usuário. Os números são sempre reconstruídos do snapshot atual. A base inteira, geometrias, fotos, nomes de operadores e assinaturas de raciocínio não são enviados. O dossiê é um resumo: não representa acesso irrestrito a todos os registros ou análise das imagens.

`js-tiktoken` estima o contexto serializado com `o200k_base` e reserva espaço para enquadramento do protocolo e correção. O tokenizer é uma aproximação entre provedores; o uso efetivo retornado pelo provedor é registrado. Para caber no orçamento, primeiro são removidas mensagens antigas do histórico; depois o dossiê perde detalhes opcionais, preservando seus fatos e sinais principais. Se ainda não couber, a análise é rejeitada antes da chamada paga. JSONs não são cortados no meio e fatos excluídos não são liberados para citação.

Uma investigação ampla precisa explorar ao menos três domínios com sinais observados, quando disponíveis. Essa checagem evita publicar apenas “faltam dados de produtividade”, mas não comprova a correção semântica da resposta. Perguntas específicas e intervalos sem registros não exigem achados artificiais. O prompt solicita resposta direta, números, hipóteses cuidadosas e verificações concretas, sem diagnosticar a causa da queda da safra.

O SDK usa `maxRetries: 0`. O fluxo normalmente faz uma geração e permite uma correção limitada, sem cache global de conversas ou análises. `AI_MAX_PROVIDER_CALLS=1` desabilita a correção. O campo de log `toolCalls` conta as cinco leituras locais do dossiê; não significa chamadas de ferramentas pelo modelo. O custo depende dos tokens e de todas as gerações do turno. Os endpoints de chat usam as políticas de retenção de cada provedor.

O modelo produz somente `answer`. O servidor valida schema, prioridades, IDs únicos dos achados e referências; resolve valores/fontes/URLs por registro próprio. Evidências calculadas mas não incluídas no dossiê não podem ser citadas. Todos os links usam uma allowlist de rotas. O React renderiza texto, sem HTML ou Markdown arbitrário.

## API e estados

- `GET /api/ai/status`: configuração local, disponibilidade da base, `datasetVersion` e mensagem; não testa saldo ou acesso ao modelo.
- `POST /api/ai/assist`: `mode`, `message`, `filters`, `datasetVersion`, `history`; retorna resposta estruturada, evidências e filtros efetivos.
- Erros públicos têm `requestId`, `error.code`, `error.message` e `error.retryable`. Dados inválidos: 400; versão diferente: 409; corpo/contexto grande: 413; limites: 429; configuração/dados/autenticação/cota: 503; falha externa ou resposta inválida: 502; timeout: 504.
- O marcador de compatibilidade é `manifest.generatedAt`; não é hash do conteúdo nem data de medição. Versão divergente é rejeitada antes de chamar o modelo.
- Cancelar, sair da rota ou mudar a versão/cobertura da base aborta o trabalho pendente. Respostas antigas são ignoradas mesmo se o aborto chegar tarde. O processamento já realizado pode ser cobrado.
- Conversas ficam apenas em memória no navegador. Mudança de provedor/modelo ou da base inicia conversa nova com aviso; filtros globais de outras telas não alteram o contexto do assistente. Atualizar o catálogo preserva o modelo e a conversa enquanto os metadados carregam. Recarregar dados limpa também o cache de promessas do frontend.
- Apenas trocas concluídas entram no histórico da próxima consulta; perguntas com falha ou canceladas continuam visíveis, sem serem reenviadas como contexto. A nova tentativa explícita repete a requisição original.
- **Verificar disponibilidade** consulta somente o status local, sem chamar o modelo, recarregar os dados ou limpar a conversa.

Logs contêm apenas identificador da requisição, latência, status, código público de erro quando houver, chamadas e uso de tokens. Não contêm chave, corpo de pergunta, resposta bruta do provedor ou dados completos. O servidor aceita somente host/origem locais e JSON, sem CORS aberto.

## Diagnóstico de falhas do provedor

Carregar o catálogo não garante que a geração de respostas funcione com todos os modelos listados. Para esta configuração local, a geração com dossiê foi validada com `GEMINI_MODEL=gemini-2.5-flash-lite`; configure o modelo no `.env` e reinicie a API para mudar o padrão. A escolha também pode ser feita pela interface, sem fallback silencioso.

- `PROVIDER_REQUEST_REJECTED` (502): o modelo rejeitou o formato da consulta; não repetir automaticamente o mesmo corpo.
- `PROVIDER_MODEL_UNAVAILABLE` (503): o modelo não está disponível para a chave; atualizar a lista e escolher outro.
- `PROVIDER_TIMEOUT` (504): o SDK atingiu o prazo sem resposta; tentar novamente ou escolher outro modelo.
- `PROVIDER_CONNECTION` (503): falha de conexão entre o servidor e o provedor.
- `PROVIDER_UNAVAILABLE` (503): indisponibilidade temporária informada pelo provedor.
- `PROVIDER_AUTH_OR_QUOTA` e `RATE_LIMITED`: conferir configuração, cota e limites da conta.

As mensagens públicas são fixas: erros externos brutos não são devolvidos ao navegador. Veja a [limitação de complexidade de schemas do Gemini](https://ai.google.dev/gemini-api/docs/structured-output).

## Limites agronômicos

`trapCode` identifica armadilhas. A contagem oficial soma caixas, não `pestCountReported` ou telemetria. Dias já normalizados não sofrem segunda conversão. Limiares são avaliados por dia/armadilha/cultura, preservando ausência, conflitos e incompatibilidade de cultura.

Operações são selecionadas por `days.some(...)`. Os totais são da OS inteira, incluindo dias fora do filtro; a interface mostra esse escopo. Doses permanecem por OS, sem média simples de médias ponderadas. Pressão zero pede conferência de sensor/telemetria/exportação; não prova defeito. Vínculos de motivos são organizacionais e contagens de alertas não medem horas ociosas. O raio de referência não é divisa legal.

As fontes podem cobrir períodos diferentes. Não é possível concluir efeito causal de aplicações sobre capturas sem sobreposição. Não há previsão futura, produtividade, finanças, medição direta de umidade do solo ou diagnóstico de estresse. Fotos não foram analisadas. Links atuais não codificam período; **Abrir histórico de operações** abre todas as OS.

A validação também corrigiu contratos preexistentes: `missions` tem números/ausências; `range` dos índices de eventos, operações e alertas é lista de dias; os intervalos do manifesto continuam pares início/fim. Severidades conhecidas `attention` e `critical` são normalizadas no backend para `atencao` e `critico`.

## Verificar e gerar artefatos

```powershell
npm.cmd test
npm.cmd run api:test
npm.cmd run lint
npm.cmd run api:typecheck
npm.cmd run build
npm.cmd run api:build
```

`build` mantém conversão dos CSVs, TypeScript e bundle Vite. `api:build` verifica os tipos do servidor e gera `dist-server/index.js` com esbuild, uma dependência direta de desenvolvimento. Dependências de produção ficam externas ao bundle.

```powershell
npm.cmd run api:start
# Também funciona a partir da raiz do repositório:
node FrontEnd/dist-server/index.js
```

Para executar o artefato com somente dependências de produção, gere os artefatos antes e use `npm.cmd ci --omit=dev` no destino. Preserve `FrontEnd/package.json`, lockfile, `dist-server/` e os JSONs configurados; o caminho padrão exige `FrontEnd/public/data/`.

`vite preview` e `dist/` não executam a API. Publicação depende de escolher hospedagem com processo Node e roteamento de `/api/ai`. Antes de expor publicamente, implementar autenticação, autorização da propriedade/dataset, limites por usuário e proteção dos JSONs que hoje estão em `public/data`. O limite local em memória por IP não substitui esses controles.

## Avaliação real

Os mocks de teste nunca aparecem como IA na aplicação. Sem chave configurada, a chamada externa e a qualidade semântica do modelo ficam pendentes. Use o [roteiro revisável de avaliação](AI_VALIDATION.md) após configurar a chave localmente. Não publique sem definir acesso aos dados, hospedagem e orçamento da equipe.

Referências oficiais do fluxo atual: [Structured Outputs e JSON na OpenAI](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=chat), [chat compatível do Gemini](https://ai.google.dev/gemini-api/docs/openai) e [parâmetros do OpenRouter](https://openrouter.ai/docs/guides/routing/provider-selection).
