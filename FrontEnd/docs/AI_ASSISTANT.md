# Assistente de análise local

A rota `#/recomendacao-ia` oferece **Análise por IA** e mantém as seis ações em **Indicadores por regras**. O modelo só é chamado após **Analisar período**, **Enviar**, clique numa pergunta ou nova tentativa explícita. A consulta de status não chama o provedor.

## Executar do zero no Windows

Requisitos: Node.js **24.19.0 ou superior**, npm e os CSVs da raiz do repositório. No PowerShell, use `npm.cmd`.

```powershell
cd FrontEnd
npm.cmd ci
Copy-Item .env.example .env
```

Preencha `OPENAI_API_KEY` em `.env` localmente, ou defina a variável no ambiente do servidor. Não envie a chave ao chat, Git, `public/` ou variáveis `VITE_*`. Sem chave, a API inicia normalmente e informa `AI_NOT_CONFIGURED` na análise; os indicadores por regras continuam funcionando.

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
| `OPENAI_API_KEY` | vazio | Chave apenas no servidor |
| `OPENAI_MODEL` | `gpt-4.1-mini` | Modelo com Responses, ferramentas e saída estruturada |
| `AI_HOST` | `127.0.0.1` | Somente loopback: `127.0.0.1`, `localhost` ou `::1` |
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

O histórico envia somente perguntas e resumos curtos, sem reenviar respostas estruturadas completas. `js-tiktoken` conta o contexto serializado com `o200k_base`, compatível com o modelo inicial, reservando 512 tokens para enquadramento do protocolo. É uma estimativa de entrada; o uso efetivo retornado pela API é registrado. Se trocar para modelo com outro tokenizer, ajuste essa contagem e reavalie o orçamento. O custo depende de todas as chamadas e tokens do turno, não há preço fixo por conversa.

O SDK usa `maxRetries: 0` e `store: false`. Isso não é promessa de retenção zero de todos os dados do serviço. Itens de ferramentas e raciocínio necessários são preservados na continuação do mesmo turno. Ao atingir o limite de ferramentas, o backend tenta finalizar com os fatos já recebidos se ainda houver orçamento. Não há cache de análises ou conversas globais.

O modelo produz somente `answer`. O servidor valida schema, prioridades e referências e resolve valores/fontes/URLs por um registro próprio. Evidências calculadas mas não enviadas ao modelo não podem ser citadas. Todos os links usam uma allowlist de rotas. O React renderiza texto, sem HTML ou Markdown arbitrário.

## API e estados

- `GET /api/ai/status`: configuração local, disponibilidade da base, `datasetVersion` e mensagem; não testa saldo ou acesso ao modelo.
- `POST /api/ai/assist`: `mode`, `message`, `filters`, `datasetVersion`, `history`; retorna resposta estruturada, evidências e filtros efetivos.
- Erros públicos têm `requestId`, `error.code`, `error.message` e `error.retryable`. Dados inválidos: 400; versão diferente: 409; corpo/contexto grande: 413; limites: 429; configuração/dados/autenticação/cota: 503; falha externa ou resposta inválida: 502; timeout: 504.
- O marcador de compatibilidade é `manifest.generatedAt`; não é hash do conteúdo nem data de medição. Versão divergente é rejeitada antes de chamar o modelo.
- Cancelar, sair da rota ou mudar filtros/versão aborta o trabalho pendente. Respostas antigas são ignoradas mesmo se o aborto chegar tarde. O processamento já realizado pode ser cobrado.
- Conversas ficam apenas em memória no navegador. Mudança de contexto inicia conversa nova com aviso. Recarregar dados limpa também o cache de promessas do frontend.
- Apenas trocas concluídas entram no histórico da próxima consulta; perguntas com falha ou canceladas continuam visíveis, sem serem reenviadas como contexto. A nova tentativa explícita repete a requisição original.
- **Verificar disponibilidade** consulta somente o status local, sem chamar o modelo, recarregar os dados ou limpar a conversa.

Logs contêm apenas identificador da requisição, latência, status, chamadas e uso de tokens. Não contêm chave, corpo de pergunta ou dados completos. O servidor aceita somente host/origem locais e JSON, sem CORS aberto.

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
