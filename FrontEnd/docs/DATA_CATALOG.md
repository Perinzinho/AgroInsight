# Catalogo de dados - AgroInsight

Documento de referencia do conjunto gerado a partir dos CSVs da raiz do
repositorio. Descreve **o que cada arquivo contem, de onde vem, como foi
normalizado e o que ele nao prova**.

Os numeros abaixo foram lidos de `public/data/manifest.json`. Se este texto e o
manifesto divergirem, o manifesto vale: ele e escrito pelo pipeline.

- Gerador: `scripts/convertCsvToJson.mjs`
- Saida: `public/data/` (48 arquivos, 16,20 MB)
- Fuso operacional: `America/Sao_Paulo`, UTC-03:00
- Referencia da propriedade: `[-49.9759, -22.2449]`, raio de 2.000 m

## Comandos

| Comando | Efeito |
| --- | --- |
| `npm run data:build` | Regera `public/data/` a partir dos CSVs |
| `npm run data:check` | Roda o pipeline inteiro sem escrever nada; imprime contagens e descartes |
| `npm test` | Suite de testes do pipeline e da aplicacao |
| `npm run lint` / `npx tsc -b` | ESLint e TypeScript |
| `npm run build` | `data:build` + `tsc -b` + `vite build` |

No PowerShell use `npm.cmd` - o `npm.ps1` e bloqueado pela politica de execucao.

## Fontes

Todas as fontes sao UTF-8, delimitadas por `;` e com fim de linha CRLF. O
relatorio climatico e o unico arquivo com BOM.

| CSV | Linhas | Vai para |
| --- | --- | --- |
| `traps_list.csv` | 32 | `traps.json` |
| `traps_data.csv` | 72 | `traps.json` (leituras, cultura, status) |
| `pest_list.csv` | 86 | `pests.json` (limiares por cultura) |
| `pest_details.csv` | 86 | `pests.json` (descricao, sintomas, fotos) |
| `traps_events.csv` | 2.293 | `events/index.json` + `events/<trapCode>.json` |
| `Relatorio Horario de 01-11-2025 - 25-02-2026 - GMT - 03h00.csv` | 2.785 | `climate/hourly.json`, `climate/daily.json` |
| `LAYER_MAP_FERTILIZATION.csv` | 26.616 | `operations/fertilization.json` + `fertilization/<os>.json` |
| `LAYER_MAP_SPRAY_PRESSURE.csv` | 12.863 | `operations/spray.json` + `spray/<os>.json` |
| `LAYER_MAP_PARAMETERIZED_ALERT.csv` | 3.834 | `machine-alerts.json` |
| `stop_reasons.csv` | 24 | `stop-reasons.json` |
| `stop_reasons_activities.csv` | 19 | `stop-reasons.json` |

## Regras de normalizacao

| Regra | Decisao |
| --- | --- |
| Identidade da armadilha | `trapCode`. `trapId` pode representar varios identificadores historicos, entao fica em `trapIds` |
| Contagem oficial | Soma das caixas em `traps_events.detection` |
| `pestCount` | Preservado como `pestCountReported`, apenas para auditoria; nao entra em indicador |
| Telemetria | `PING` e `CLIENT_BATTERY_VOLTAGE` ficam fora das contagens de praga |
| Limiares | `pest_list.MIIP_PEST_ALERT / CONTROL / DAMAGE` por cultura |
| Dia | Dia local da fazenda (UTC-03) derivado do instante UTC; `at` e sempre UTC |
| Coordenadas | WKT lido como `(longitude latitude)`, sem inversao |
| Numeros | Virgula decimal, aceitando `1.234,56` e notacao cientifica |
| Booleanos | Apenas `true`/`false` (Python e JSON); qualquer outra grafia vira `null` |

### Variante de limiar divergente

Quando `pest_list.csv` traz mais de um limiar para a mesma praga e cultura, o
pipeline **nao escolhe silenciosamente**: usa o mais alto, marca
`variantsConflicting` e expoe `thresholdSummary` no formato
`Cultura: alerta/controle/dano`, que aparece na camada "Contagem" da prova em
tres camadas. A lista completa das variantes vai na nota.

## Saidas

### `manifest.json`

Indice do conjunto: `generatedAt`, `generator`, fuso, `farmReference`,
`farmReferenceRadiusMeters`, `rules`, `sources` (delimitador, encoding, BOM, fim
de linha, linhas, colunas, bytes, `modifiedAt`), `outputs` (arquivo, descricao,
fonte, bytes, linhas, `lazy`), `coverage`, `discarded` e `warnings`.

### `traps.json` - 14 armadilhas

Chaves: `property`, `bounds`, `traps[]`.

Cada armadilha traz `trapCode`, `trapIds[]`, `latitude`, `longitude`, `type`,
`status`, `radius`, `plotId`, `requestGps`, o programa de fotos
(`photoProgrammedAt`, `secondPhotoTime`, `photoWeekdays`), datas de manutencao
(`installationDate`, `lastAdhesiveFloorReplacement`, `lastPheromoneExchange`),
`sources`, `history`, `latest`, `cultures`, `statusesSeen`, `infestationsSeen`,
`primaryPestsSeen` e `readingsFromUnknownTrapId`.

> Dois codigos aparecem so em `traps_data.csv`. Seis leituras vem de `trapId`
> fora do catalogo e ficam sinalizadas em `readingsFromUnknownTrapId`.

### `events/index.json` + `events/<trapCode>.json` - lazy

O indice traz `range`, `typeCounts` (436 `IMAGE`, 1.702 `PING`, 155
`CLIENT_BATTERY_VOLTAGE`), `totalCaptures` (436), `totalDetections` (8.706),
`divergentCount` (56) e `traps[]` com `eventCount`, `imageCount`,
`telemetryCount`, `batteryReadings`, `firstAt`, `lastAt`, `lastCaptureAt` e o
`file` a carregar sob demanda.

Cada arquivo de armadilha tem `trapCode`, `eventCount` e `events[]`, com
`eventId`, `sessionId`, `trapCode`, `trapId`, `at` (UTC), `day` (local),
`type`, `imageUrl`, `summary`, `detections[]`, `detectedTotal`,
`pestCountReported`, `countAgreement`, `batteryVoltage` e `sourceRow`.

Cada item de `detections[]` tem `pestKey`, `pestName`, `pestId`, `detections`,
`meanConfidence`, `minConfidence` e `boxes[]` em `[x, y, largura, altura]`.

Cobertura: 2026-01-26 a 2026-02-25.

### `trap-series.json` - 179 linhas

Serie por `trapCode` e dia: `captures`, `detections`, `images`, `pings`,
`batteryReadings`, `batteryVoltageMean`, `divergentEvents` e `pests[]`. E a
fonte das linhas do grafico de tendencia e do comparador.

### `pests.json` - 35 grupos, 43 variantes por cultura

`groups[]` com `key`, `popularName`, `scientificNames`, `detectionNames`,
`classification`, `cultures`, `hasDocumentation`, `hasReferencePhotos` e
`variants[]` (cultura + `thresholds`).

> 12 das 35 pragas nao tem descricao nem sintomas em `pest_details.csv`; a
> interface diz isso em vez de exibir um cartao vazio.

### `climate/hourly.json` (lazy) e `climate/daily.json`

`hourly.json` tem 2.785 horas com `at`, `day`, `precipitation`,
`evapotranspiration`, `temperature{Min,Mean,Max}`, `humidity{Min,Mean,Max}`,
`windMean`, `windGust`, `solarRadiation`, `station`, `stationLatitude`,
`stationLongitude`.

`daily.json` tem 117 dias com `hours`, `precipitation`, `evapotranspiration`,
`waterBalance`, `temperature{Min,Mean,Max}`, `humidity{Min,Mean,Max}`,
`windMean`, `windGust`, `solarRadiation` e `missingHours`.

Cobertura: 2025-11-01 a 2026-02-25 - cobre todo o periodo de eventos de praga.

### `operations/fertilization.json` e `operations/spray.json`

Cabecalhos com `kind`, `source`, `machineColumn`, `operationColumn`, `columns`,
`operationSpellings`, `range` e `sources`; `operations[]` com `file`,
`serviceOrder`, `operation`, `operationRawSpellings[]`, `machine`, `team`,
`operator`, `firstAt`, `lastAt`, `days`, `segments`, `reportedAreaHa`,
`geometryAreaHa`, `segmentsWithArea`, `appliedDoseKgHaWeighted`,
`configuredDoseKgHaWeighted`, `appliedVsConfiguredPct`, `weightKg`,
`zeroDoseSegments`, `belowConfiguredSegments`, `aboveConfiguredSegments`,
`missingPressureSegments`, `zeroPressureSegments`, `farFromFarmSegments`,
`maxDistanceMeters` e `bounds`.

Cobertura: fertilizacao 2025-08-22 a 2025-11-15 (14 OS); pulverizacao
2025-12-03 a 2025-12-19 (9 OS).

### `fertilization/<os>.json` e `spray/<os>.json` - lazy

Carregados so ao abrir a OS. Trazem `days`, `segments[]` (`at`, `day`,
`areaHa`, `appliedDoseKgHa`, `configuredDoseKgHa`, `weightKg`, `pressurePsi`,
`distanceMeters`, `bbox`, `sourceRow`) e, na pulverizacao, `paths[]` com
`coordinates` para desenhar a trajetoria.

> A OS de gessagem `7` tem 4.542 segmentos e fica a cerca de 6,2 km da
> referencia. E um outlier real e continua visivel como tal.

### `machine-alerts.json` - 2.359 alertas

`range`, `note`, `alertTypes`, `classifications`, `classificationBasis`,
`unclassified`, `outOfProperty` e `alerts[]` com `alertId`, `at`, `day`,
`machine`, `serviceOrder`, `team`, `operator`, `operation`, `operationRaw`,
`alert`, `value`, `durationSeconds`, `stopReasonText`, `stopReasons`,
`classification`, `classificationBasis`, `classifiedActivity`, `location`,
`distanceFromFarmMeters`, `outOfProperty` e `sourceRow`.

Cobertura: 2025-08-22 a 2026-02-25. 213 alertas ficam sem classificacao porque
o arquivo nao traz o id do motivo de parada; o vinculo e feito por
`Operation -> atividade -> motivo`, e `classificationBasis` diz que esse
mapeamento e **organizacional, nao prova causal**.

### `stop-reasons.json`

`reasons[]` (24 motivos), `activities[]` (6 atividades), `byOperation[]` com as
grafias de `Operation` reconhecidas e `operationFamilyMapping[]` com o nome da
atividade e o motivo consolidado.

## Descarte e correcao

`manifest.discarded` registra dataset, arquivo, motivo, contagem e ate cinco
exemplos com a linha original.

| Registros | Arquivo | Motivo |
| --- | --- | --- |
| 1.475 | `LAYER_MAP_PARAMETERIZED_ALERT.csv` | Alerta repetido byte a byte |
| 43 | `pest_list.csv` | Linha duplicada por id + cultura |
| 43 | `pest_details.csv` | Linha duplicada por id |
| 16 | `traps_list.csv` | Armadilha repetida byte a byte |
| 13 | `stop_reasons_activities.csv` | Atividade repetida por id |
| 12 | `traps_data.csv` | Leitura repetida byte a byte |
| 10 | `LAYER_MAP_FERTILIZATION.csv` | Linha sem operacao, agrupada como "sem classificacao" |

## Limites conhecidos

Estes limites aparecem em `manifest.warnings` e na tela de qualidade de dados.

| ID | Fato |
| --- | --- |
| `pest-vs-spray` | Eventos em jan/2026 e pulverizacao em dez/2025 nao tem janela comum |
| `pest-vs-fertilization` | Eventos em jan/2026 e fertilizacao em ago-nov/2025 nao tem janela comum |
| `spray-pressure` | Os 12.863 trechos tem pressao `0`; nenhuma faixa foi aplicada por nao haver valor de negocio validado |
| `stop-reason-link` | 213 de 2.359 alertas sem classificacao direta |
| `trap-count-divergence` | 56 eventos com `pestCount` diferente da soma das caixas |
| `alerts-outside-property` | 663 de 2.359 alertas a mais de 2 km da referencia |
| `pest-documentation` | 12 de 35 pragas sem descricao nem sintomas |
| `climate-coverage` | Estacao clima cobre todo o periodo de eventos de praga |

Alem disso:

- **Nao existe geometria do limite da propriedade.** O mapa usa apenas o circulo
  de `farmReference` com raio de 2 km, rotulado como referencia, nao como
  contorno.
- **Nao existem imagens aereas.** Nenhum raster e gerado e nenhum mapa base e
  inventado; a camada simplesmente nao existe.
- **A aplicacao nao afirma causa agronomica.** Onde a fonte nao sustenta a
  relacao, a tela exibe os fatos lado a lado.