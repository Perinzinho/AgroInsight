# Assistente de análise local

A rota `#/recomendacao-ia` oferece **Análise por IA** e **Indicadores por IA**. Os cartões usam os achados da última análise concluída: títulos, prioridades, explicações e ações são gerados pelo modelo; valores e fontes são resolvidos pelas evidências validadas no servidor. O antigo gerador de seis recomendações fixas foi removido. O modelo só é chamado após **Analisar período**, **Enviar**, clique numa pergunta ou nova tentativa explícita. A consulta de status não chama o provedor.

Os indicadores são preenchidos ao clicar em **Analisar período**. Perguntas do chat podem apresentar achados na conversa e não substituem os indicadores da análise geral. Sem resposta válida, o bloco permanece vazio; uma resposta válida sem achados informa essa ausência. Nova tentativa com falha não substitui uma análise já concluída. Limpar a conversa ou mudar filtros, base, provedor ou modelo descarta os indicadores anteriores.

Para iniciar frontend e API juntos com containers, execute `docker compose up --build -d` na raiz do repositório. Veja o [guia do Docker](../../docker/README.md).

## Executar do zero no Windows

Requisitos: Node.js **24.19.0 ou superior**, npm e os CSVs da raiz do repositório. No PowerShell, use `npm.cmd`.

```powershell
cd FrontEnd
npm.cmd ci
Copy-Item .env.example .env
```

Preencha `GEMINI_API_KEY` ou `OPENROUTER_API_KEY` em `.env` localmente, ou defina a variável no ambiente do servidor. A integração anterior com `OPENAI_API_KEY` continua aceita. Não envie a chave ao chat, Git, `public/` ou variáveis `VITE_*`. Sem chave, a API inicia normalmente e informa `AI_NOT_CONFIGURED` na análise; os demais painéis de dados continuam disponíveis e os indicadores por IA aguardam configuração.

Na aba **Recomendação (IA)**, escolha **Provedor de IA** e **Modelo** antes de analisar ou perguntar. Provedores sem chave são identificados e bloqueiam os envios até serem configurados. A troca cancela o trabalho pendente e inicia uma conversa vazia. A preferência fica no `localStorage` do navegador; perguntas e respostas continuam apenas em memória. A seleção válida é preservada ao mudar os filtros ou recarregar a página.

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
| `AI_PROVIDER` | primeiro configurado | Padrão opcional: `gemini`, `openrouter` ou `openai`; sem essa variável, prioridade Gemini → OpenRouter → OpenAI |
| `GEMINI_API_KEY` | vazio | Chave Gemini apenas no servidor |
| `GEMINI_MODEL` | `gemini-3.8-flash` | Modelo inicial do Gemini |
| `GEMINI_MODELS` | `gemini-3.8-flash,gemini-3.5-flash-lite` | Modelos permitidos na interface, separados por vírgulas |
| `OPENROUTER_API_KEY` | vazio | Chave OpenRouter apenas no servidor |
| `OPENROUTER_MODEL` | `google/gemini-2.5-flash` | Modelo inicial do OpenRouter |
| `OPENROUTER_MODELS` | `google/gemini-2.5-flash,openai/gpt-4.1-mini` | Modelos permitidos no OpenRouter, com o prefixo do fornecedor |
| `OPENAI_API_KEY` | vazio | Chave apenas no servidor |
| `OPENAI_MODEL` | `gpt-4.1-mini` | Modelo com Responses, ferramentas e saída estruturada |
| `OPENAI_MODELS` | vazio | Modelos adicionais da integração existente |
| `AI_HOST` | `127.0.0.1` | `127.0.0.1`, `localhost`, `::1` ou `0.0.0.0` para a rede do container; no Compose, somente o proxy web publica uma porta local |
| `AI_PORT` | `5175` | Porta da API e destino do proxy |
| `AI_TIMEOUT_MS` | `60000` | Tempo total do turno, incluindo leitura dos dados |
| `AI_MAX_OUTPUT_TOKENS` | `2000` | Saída máxima por chamada |
| `AI_MAX_INPUT_TOKENS` | `12000` | Orçamento de contexto por chamada |
| `AI_MAX_TOOL_ROUNDS` | `4` | Rodadas com ferramentas |
| `AI_MAX_TOOL_CALLS` | `8` | Execuções totais de ferramentas |
| `AI_MAX_PROVIDER_CALLS` | `6` | Chamadas totais ao provedor |
| `AI_RATE_LIMIT_PER_MINUTE` | `10` | Turnos por IP local por minuto |
| `AI_MAX_CONCURRENT_REQUESTS` | `2` | Turnos simultâneos no servidor |
| `AI_DATA_DIR` | `./public/data` | Diretório administrativo do snapshot |

Todos os números são inteiros positivos com tetos validados em `server/config.ts`. Pergunta: até 2.000 caracteres. Histórico: até 12 mensagens de usuário/assistente e 12.000 caracteres. Corpo: até 64 KiB. Período: datas reais, inclusivas, até 366 dias. IDs desconhecidos, campos extras e papéis privilegiados são rejeitados antes do provedor.

Cada `*_MODEL` é incluído automaticamente na lista do respectivo provedor, sem duplicação. As listas são administradas no servidor, com até 100 modelos por provedor; a interface não carrega um catálogo externo nem consulta saldo. Use modelos que suportem ferramentas e JSON Schema. Reinicie a API após alterar o `.env`. O backend rejeita modelos fora da lista antes de qualquer chamada externa e nunca muda de provedor/modelo automaticamente durante uma análise. As URLs das APIs são fixas no servidor.

## Economia de tokens e fluxo de evidências

O backend lê e valida os dez JSONs base do disco. Reutiliza um snapshot completo em memória e verifica metadados dos arquivos antes de reutilizá-lo. Uma atualização só substitui o snapshot após validação completa e conferência de estabilidade durante a leitura. Não regenere dados enquanto uma análise estiver em andamento.

O contexto inicial contém fuso, dia atual da propriedade, filtros, cobertura e marcador de versão. A base inteira, geometrias, fotos e nomes de operadores não são enviados ao modelo. O modelo escolhe entre cinco consultas somente de leitura:

| Ferramenta | Argumentos |
| --- | --- |
| `consultarResumo` | `{}` |
| `consultarPragas` | `{}` |
| `consultarClima` | `{}` |
| `consultarOperacoes` | `{ "kind": "fertilization" / "spray" / "both" }` |
| `consultarAlertasMaquina` | `{}` |

As consultas usam os seletores e o motor de limiares existentes. Rankings e séries têm até dez itens, com total e indicação de truncamento; agregados usam todos os registros filtrados. Cada domínio informa observações, cobertura, unidades, escopo, limitações e evidências. Ausência de cobertura não vira chuva ou detecção zero medida.

As saídas são compactadas por turno: fontes, escopos e períodos repetidos ficam em `evidenceContexts`, e fatos já enviados são referenciados pelo ID. Todos os valores, amostras, contagens e limitações são preservados. Os filtros congelados permanecem no contexto inicial. Essa compactação evita reenviar as mesmas evidências quando o modelo consulta o resumo e as quatro ferramentas especializadas. Uma análise do período completo calcula totais sobre todos os dias com dados; as listas limitadas não são uma análise individual de cada dia.

O histórico envia somente perguntas e resumos curtos, sem reenviar respostas estruturadas completas. `js-tiktoken` estima o conteúdo com `o200k_base`, contando textos e resultados de ferramentas sem o escape adicional do JSON de transporte, reservando 512 tokens globais e 32 por item para enquadramento. Para Gemini/OpenRouter, a estimativa inclui as definições das ferramentas durante a consulta e o schema durante a finalização, conforme o conteúdo de cada chamada. Esse tokenizer é uma aproximação para Gemini e outros modelos; não impõe um teto exato aos tokens faturados. O uso efetivo retornado por cada provedor é registrado. Reavalie os orçamentos ao trocar de modelo. O custo depende de todas as chamadas e tokens do turno, não há preço fixo por conversa.

O SDK usa `maxRetries: 0`; a integração OpenAI usa Responses com `store: false`. Gemini e OpenRouter usam Chat Completions, sem enviar parâmetros exclusivos de Responses. Isso não é promessa de retenção zero de todos os dados dos serviços. Itens de ferramentas e extensões de raciocínio/assinaturas são preservados na continuação do mesmo turno, sem publicá-los ao navegador. Gemini usa `reasoning_effort: low`. No OpenRouter, `provider.require_parameters: true` exige endpoints que aceitem os recursos solicitados.

Para Gemini/OpenRouter, a consulta de ferramentas e a finalização com JSON Schema ocorrem em etapas separadas para acomodar modelos que não aceitam os dois modos juntos. Se o modelo indicar que terminou de consultar, uma chamada adicional solicita a resposta estruturada; ela conta nos mesmos limites de tempo, chamadas e tokens. Ao atingir o limite de ferramentas, o backend tenta finalizar com os fatos já recebidos se ainda houver orçamento. Não há cache de análises ou conversas globais.

O modelo produz somente `answer`. O servidor valida schema, prioridades e referências e resolve valores/fontes/URLs por um registro próprio. Evidências calculadas mas não enviadas ao modelo não podem ser citadas. Todos os links usam uma allowlist de rotas. O React renderiza texto, sem HTML ou Markdown arbitrário.

As instruções pedem profundidade proporcional à pergunta: análises e comparações devem apresentar números, unidades, datas e identificadores disponíveis, explicar a importância dos achados e indicar verificações concretas. O modelo deve consultar ferramentas especializadas quando a síntese não fornecer detalhe suficiente. Perguntas simples podem receber respostas curtas; a orientação anterior de ser breve para economizar tokens foi removida. Os limites de consumo e a validação de evidências continuam aplicados.

**Analisar período** usa uma orientação própria para uma síntese executiva: três parágrafos curtos (aproximadamente 150 a 220 palavras quando houver dados), cobrindo panorama, principais sinais e prioridades/próximos passos. A resposta integra os domínios disponíveis e menciona lacunas, sem descrever cada dia. Os cartões trazem preferencialmente três a cinco prioridades sustentadas, sem quantidade obrigatória quando faltam dados. `summary` aceita até 3.200 caracteres; explicações e ações individuais continuam limitadas a 1.600. Essa extensão orienta o modelo, sem impor um tamanho mínimo a respostas sobre períodos sem cobertura.

## API e estados

- `GET /api/ai/status`: configuração local, disponibilidade da base, `datasetVersion`, mensagem, `providers` (ID, nome, configurado, modelos e modelo inicial) e `defaultSelection`; não revela chaves nem testa saldo ou acesso ao modelo.
- `POST /api/ai/assist`: `mode`, `message`, `filters`, `datasetVersion`, `history`, `provider`, `model`; retorna resposta estruturada, evidências, filtros efetivos e `selection` com o provedor/modelo utilizados. `provider` e `model` devem vir juntos; clientes antigos que omitem os dois usam o padrão do servidor. O frontend confere se a seleção retornada corresponde à solicitada.
- Erros públicos têm `requestId`, `error.code`, `error.message` e `error.retryable`. Dados inválidos: 400; versão diferente: 409; corpo/contexto grande: 413; limites: 429; configuração/dados/autenticação/cota: 503; falha externa ou resposta inválida: 502; timeout: 504.
- O marcador de compatibilidade é `manifest.generatedAt`; não é hash do conteúdo nem data de medição. Versão divergente é rejeitada antes de chamar o modelo.
- Cancelar, sair da rota ou mudar filtros/versão aborta o trabalho pendente. Respostas antigas são ignoradas mesmo se o aborto chegar tarde. O processamento já realizado pode ser cobrado.
- Conversas ficam apenas em memória no navegador. Mudança de contexto inicia conversa nova com aviso. Recarregar dados limpa também o cache de promessas do frontend.
- Apenas trocas concluídas entram no histórico da próxima consulta; perguntas com falha ou canceladas continuam visíveis, sem serem reenviadas como contexto. A nova tentativa explícita repete a requisição original.
- **Verificar disponibilidade** consulta somente o status local, sem chamar o modelo, recarregar os dados ou limpar a conversa.

Logs contêm identificador da requisição, latência, status, provedor/modelo, código público de erro, etapa/campos de validação, chamadas, uso de tokens, maior estimativa de entrada e orçamento configurado. Não contêm chave, corpo de pergunta ou conteúdo da resposta rejeitada. O servidor aceita somente host/origem locais e JSON, sem CORS aberto.

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

Referências oficiais usadas na implementação: [function calling](https://developers.openai.com/api/docs/guides/function-calling), [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [estado e armazenamento](https://developers.openai.com/api/docs/guides/migrate-to-responses) e [autenticação](https://developers.openai.com/api/reference/overview#authentication).

Integrações adicionais: [compatibilidade OpenAI do Gemini](https://ai.google.dev/gemini-api/docs/openai), [modelos Gemini 3.8 Flash](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash) e [3.5 Flash-Lite](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite), [saídas estruturadas do OpenRouter](https://openrouter.ai/docs/guides/features/structured-outputs) e [seleção de endpoints](https://openrouter.ai/docs/guides/routing/provider-selection). A disponibilidade depende da conta e pode mudar; ajuste as listas no servidor quando necessário.
