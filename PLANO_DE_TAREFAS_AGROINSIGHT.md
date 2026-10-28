# Plano de tarefas do AgroInsight

## Objetivo do primeiro mes

Transformar o dashboard demonstrativo atual em um prototipo funcional de analise operacional da lavoura. O foco do mes deve ser responder, com dados rastreaveis, tres perguntas:

1. Onde esta o maior risco agora?
2. Qual evidencia sustenta esse alerta?
3. Qual acao deve ser priorizada pela equipe?

O resultado esperado e uma experiencia que combine serie temporal, localizacao, severidade, imagem e contexto operacional. Cada alerta deve apontar para os dados de origem e deixar claro quando a conclusao e apenas uma regra de negocio, e nao uma previsao validada por modelo.

## Diagnostico do estado atual

- O frontend usa React, TypeScript, Vite e Chart.js.
- `FrontEnd/src/App.tsx` ainda apresenta metricas, mensagens, talhoes e valores de temperatura/umidade/chuva fixos.
- Os dois graficos atuais leem `FrontEnd/src/data/pestChart.json` e `FrontEnd/src/data/fertilizationChart.json`, em vez de ler os CSVs.
- `traps_events.csv` ja possui URLs de imagens, contagens de pragas, tipo de evento e deteccoes com confianca e caixas delimitadoras.
- `traps_list.csv` possui latitude, longitude, talhao, tipo e status das armadilhas.
- Os arquivos `LAYER_MAP_*.csv` possuem geometria espacial em WKT, timestamps e dados de operacao.
- O relatorio horario possui clima, chuva, vento, temperatura, umidade e evapotranspiracao.
- `pest_details.csv` possui descricoes, sintomas e imagens de referencia para as pragas.
- Nao ha, nos arquivos analisados, um mapa aereo ou imagens de drone/satelite da lavoura. Portanto, a primeira entrega deve usar mapa e imagens de armadilhas; visao aerea deve ser preparada como extensao ou demonstracao controlada.

## Escala de prioridade

- **P0 - essencial:** precisa estar pronto para o prototipo de um mes.
- **P1 - diferencial viavel:** entregar somente se o P0 estiver estavel.
- **P2 - proxima fase:** especificar e validar, mas nao comprometer o MVP.

## Backlog priorizado

### P0. Definir o contrato de dados e a origem de cada indicador

**Descricao:** criar um catalogo das fontes, chaves, unidades, delimitadores, tipos e regras de limpeza. Documentar que os CSVs usam `;`, que existem valores `nan`, campos vazios, duplicidades e nomes de colunas inconsistentes entre arquivos. Registrar a data de atualizacao e o fuso horario de cada dataset.

**CSV usado:** todos os CSVs da raiz.

**Criterios de aceite:** cada indicador exibido no dashboard possui fonte, coluna, unidade, regra de agregacao e tratamento de ausencia documentados; nenhum valor fixo do dashboard e apresentado como dado real.

### P0. Construir uma camada de leitura e normalizacao dos CSVs

**Descricao:** preparar uma camada unica de importacao para os CSVs, convertendo datas, numeros, booleanos, `nan` e geometrias. Padronizar nomes de pragas, operacoes e status. Manter os dados originais identificaveis para auditoria.

**CSV usado:** `traps_data.csv`, `traps_events.csv`, `traps_list.csv`, `pest_list.csv`, `pest_details.csv`, `Relatório Horário de 01-11-2025 - 25-02-2026 - GMT - 03h00.csv`, `LAYER_MAP_FERTILIZATION.csv`, `LAYER_MAP_PARAMETERIZED_ALERT.csv`, `LAYER_MAP_SPRAY_PRESSURE.csv`, `stop_reasons.csv` e `stop_reasons_activities.csv`.

**Criterios de aceite:** a leitura suporta o volume atual sem travar a interface; registros invalidos sao contabilizados; datas e numeros podem ser agregados sem depender de conversoes manuais na tela.

### P0. Resolver o modelo de relacionamento entre entidades

**Descricao:** definir e testar os relacionamentos entre armadilha, evento, praga, fazenda, talhao, safra e operacao. Usar `trapId`, `trapCode`, `code`, `id` da praga, `farm`, `plot`, `harvest` e `businessUnit` como chaves candidatas, registrando os casos em que a chave nao fecha.

**CSV usado:** `traps_list.csv`, `traps_data.csv`, `traps_events.csv`, `pest_list.csv` e `pest_details.csv`.

**Criterios de aceite:** ao selecionar uma armadilha, a aplicacao consegue chegar aos eventos, imagens, pragas, localizacao, status e ultima leitura sem misturar armadilhas convencionais e eletronicas.

### P0. Substituir metricas fixas por indicadores calculados

**Descricao:** substituir os seis cards estaticos de `App.tsx` por indicadores calculados e filtraveis: pragas detectadas, armadilhas em alerta, armadilhas sem leitura recente, maior contagem por praga, operacoes recentes e percentual de dose aplicada versus configurada. Exibir sempre periodo e unidade.

**CSV usado:** `traps_data.csv`, `traps_events.csv`, `traps_list.csv`, `LAYER_MAP_FERTILIZATION.csv` e `LAYER_MAP_SPRAY_PRESSURE.csv`.

**Criterios de aceite:** alterar o periodo ou a cultura recalcula os cards; os valores podem ser conferidos diretamente nos registros de origem; o estado vazio e o estado de erro sao tratados.

### P0. Implementar filtros de periodo, cultura, praga, tipo e status

**Descricao:** transformar o filtro visual “Ultimos 7 dias” em controle funcional. Permitir periodo predefinido e intervalo customizado, cultura, praga, tipo de armadilha, status da armadilha e nivel de infestacao. Preservar os filtros ao navegar entre resumo, mapa e detalhe.

**CSV usado:** `traps_events.csv`, `traps_data.csv`, `traps_list.csv`, `pest_list.csv` e `pest_details.csv`.

**Criterios de aceite:** todos os graficos, cards, mapa e lista respondem aos mesmos filtros; o usuario consegue limpar filtros; o periodo selecionado fica visivel.

### P0. Criar a tela de tendencia de pragas

**Descricao:** alem do donut atual, criar serie temporal por dia para as pragas detectadas e comparar armadilhas convencionais com eletronicas. Destacar crescimento, queda, pico e ausencia de coleta. Nao somar eventos `PING` ou telemetria como capturas.

**CSV usado:** `traps_events.csv`, com apoio de `traps_data.csv`, `traps_list.csv` e `pest_list.csv`.

**Criterios de aceite:** eventos `IMAGE` e suas deteccoes sao separados de `PING` e `CLIENT_BATTERY_VOLTAGE`; a serie mostra contagem e quantidade de imagens; a legenda identifica a fonte.

### P0. Criar o mapa operacional da propriedade

**Descricao:** exibir armadilhas por latitude/longitude, coloridas por nivel de infestacao ou status. Ao clicar em uma armadilha, mostrar ultima captura, praga principal, contagem, bateria quando disponivel, ultima imagem e link para o detalhe. Usar um mapa web com tiles ou uma alternativa que nao exija desenhar o mapa manualmente.

**CSV usado:** `traps_list.csv`, `traps_data.csv` e `traps_events.csv`.

**Criterios de aceite:** todos os pontos validos aparecem; coordenadas ausentes ou invalidas nao quebram o mapa; o mapa diferencia armadilha convencional de eletronica; o painel lateral possui estado de carregamento e estado sem eventos.

### P0. Criar o detalhe de uma armadilha com evidencia visual

**Descricao:** criar um fluxo de detalhe com galeria de imagens reais vindas das URLs de `traps_events.csv`, data/hora, praga detectada, contagem, confianca e caixas delimitadoras quando disponiveis. Permitir abrir a imagem em tamanho maior e acessar a imagem anterior/posterior da mesma armadilha.

**CSV usado:** `traps_events.csv`, `traps_list.csv` e `traps_data.csv`.

**Criterios de aceite:** a URL e a data do evento ficam visiveis; falha de carregamento da imagem apresenta alternativa textual; a aplicacao nao afirma que a deteccao e certa quando a confianca e baixa; imagens sao associadas a uma armadilha e nao apenas a uma praga.

### P0. Criar regras transparentes de alerta e recomendacao

**Descricao:** implementar regras simples, configuraveis e explicaveis para priorizar alertas: contagem acima do historico recente, aumento consecutivo, nivel `ALERT` ou `DAMAGE`, bateria inadequada, armadilha inativa e evento sem imagem. Cada recomendacao deve exibir a regra acionada, a evidencia e o proximo passo sugerido.

**CSV usado:** `traps_data.csv`, `traps_events.csv`, `traps_list.csv`, `pest_list.csv` e `pest_details.csv`.

**Criterios de aceite:** cada alerta possui severidade, data, armadilha, praga, evidencias e justificativa; thresholds nao ficam espalhados no componente visual; o usuario consegue distinguir alerta de dado informativo.

### P0. Integrar clima ao contexto de risco

**Descricao:** mostrar chuva, temperatura, umidade, vento e evapotranspiracao no mesmo periodo das ocorrencias de pragas. O primeiro modelo de risco deve ser uma correlacao descritiva ou regra de contexto, sem alegar causalidade. Exemplo: “houve aumento de capturas durante periodo de alta umidade”, sempre com periodo e amostra.

**CSV usado:** `Relatório Horário de 01-11-2025 - 25-02-2026 - GMT - 03h00.csv`, `traps_events.csv` e `traps_data.csv`.

**Criterios de aceite:** datas sao alinhadas por fuso e granularidade; o painel mostra quando nao ha dados climaticos para o local; a interface diferencia correlacao observada de recomendacao agronomica.

### P0. Integrar operacoes de fertilizacao e pulverizacao

**Descricao:** criar visao operacional com area coberta, dose aplicada, dose configurada, peso aplicado, pressao registrada e trajetoria da maquina. Destacar trechos sem cobertura, dose abaixo/acima da configurada e pressao zero ou fora da faixa definida pelo negocio. O calculo deve permitir agregacao por data, ordem de servico e operacao.

**CSV usado:** `LAYER_MAP_FERTILIZATION.csv` e `LAYER_MAP_SPRAY_PRESSURE.csv`.

**Criterios de aceite:** o usuario escolhe operacao e data; a tela mostra mapa e resumo numerico; linhas com geometria invalida ou pressao ausente sao sinalizadas; nenhuma faixa agronomica e inventada sem configuracao validada pela equipe.

### P0. Relacionar alertas de maquina e motivos de parada

**Descricao:** criar uma lista de ocorrencias operacionais com tipo de alerta, duracao, valor, local e motivo de parada. Relacionar IDs de `stop_reasons_activities.csv` com nomes de `stop_reasons.csv` para indicar impacto produtivo, manutencao, clima ou administracao.

**CSV usado:** `LAYER_MAP_PARAMETERIZED_ALERT.csv`, `stop_reasons.csv` e `stop_reasons_activities.csv`.

**Criterios de aceite:** nomes de motivos aparecem em vez de somente IDs; a lista pode ser ordenada por duracao, tipo e data; eventos sem motivo sao marcados como “sem classificacao”.

### P0. Criar um dicionario visual de pragas e danos

**Descricao:** ao selecionar uma praga, exibir nome popular, nome cientifico, cultura, sintomas, dano, nivel de alerta/controle/dano e imagens de referencia. O conteudo deve servir para explicar o alerta, nao para substituir recomendacao de um agronomo.

**CSV usado:** `pest_list.csv` e `pest_details.csv`.

**Criterios de aceite:** pragas com nomes duplicados ou variacoes de acentuacao sao consolidadas; imagens de referencia ficam separadas das imagens de evidencia da armadilha; a cultura e respeitada no filtro.

### P0. Testar qualidade, desempenho e rastreabilidade

**Descricao:** criar casos de teste para parsing, agregacoes, filtros, associacao de imagens, geometrias, datas, dados vazios e contagens. Medir o tempo de carregamento com os CSVs atuais e evitar carregar todo o texto bruto de `traps_events.csv` na tela inicial.

**CSV usado:** todos os CSVs, com maior foco em `traps_events.csv` e nos tres `LAYER_MAP_*.csv`.

**Criterios de aceite:** `npm run lint` e `npm run build` passam; os principais calculos possuem testes; a tela inicial carrega uma amostra agregada e detalhes sob demanda; ha uma lista dos registros descartados na normalizacao.

## Diferenciais viaveis para o primeiro mes

### P1. Alerta com “prova em tres camadas”

Combinar, no mesmo item, a contagem ou deteccao da armadilha, o ponto no mapa e a imagem correspondente. Acrescentar clima e historico apenas como contexto. Esse diferencial e viavel porque os dados ja possuem URL de imagem, timestamp, praga, contagem, confianca, coordenadas e status.

**CSV usado:** `traps_events.csv`, `traps_list.csv`, `traps_data.csv` e o relatorio horario.

### P1. Comparador de armadilhas ou talhoes

Permitir comparar duas armadilhas ou dois agrupamentos por contagem, tendencia, severidade, ultima leitura, bateria e quantidade de imagens. O objetivo e responder “onde agir primeiro”, sem tentar prever produtividade.

**CSV usado:** `traps_events.csv`, `traps_data.csv`, `traps_list.csv` e `pest_list.csv`.

### P1. Detecao assistida de anomalias

Usar regras estatisticas simples, como aumento percentual contra a mediana dos ultimos eventos validos, para marcar comportamento fora do padrao. Exibir o historico que gerou a comparacao e permitir confirmar ou ignorar o alerta.

**CSV usado:** `traps_events.csv` e `traps_data.csv`.

### P1. Evidencia aerea com imagem demonstrativa controlada

Preparar o componente e o contrato para receber uma imagem aerea georreferenciada, mas usar somente uma imagem real fornecida pela equipe ou uma camada de mapa com delimitacao dos talhoes. Sobrepor pontos de armadilha e alertas existentes. Nao inferir pragas da imagem aerea no primeiro mes.

**CSV usado:** `traps_list.csv`, `traps_data.csv`, `LAYER_MAP_FERTILIZATION.csv` e `LAYER_MAP_SPRAY_PRESSURE.csv`. **Dependencia externa:** imagem aerea com data, resolucao e coordenadas.

### P1. Catalogo visual de pragas como apoio a classificacao

Usar as fotos de `pest_details.csv` para mostrar exemplos lado a lado com a evidencia capturada. O primeiro passo deve ser consulta e comparacao visual; classificacao automatica de foto enviada deve ficar como experimento opcional.

**CSV usado:** `pest_details.csv`, `pest_list.csv` e `traps_events.csv`.

## Uso de fotos e visao de cima

### Fotos de armadilhas: recomendado para o MVP

Faz sentido e ja existe dado operacional. As fotos podem sustentar uma decisao sobre contagem e tipo de praga, alem de permitir auditoria humana. A tarefa deve priorizar galeria, zoom, timestamp, confianca e vinculo com a armadilha.

### Fotos de pragas: recomendado como contexto

Faz sentido para explicar nomes, sintomas e diferencas entre especies. As fotos de `pest_details.csv` sao imagens de referencia e nao devem ser apresentadas como captura daquele dia ou daquela armadilha.

### Fotos de cima ou drone: recomendado somente como camada de contexto

Faz sentido para localizar talhoes, trajetorias, faixas tratadas e concentracao espacial de alertas. Nao ha imagens aereas nos CSVs atuais, e detectar pragas ou estresse apenas com uma imagem aerea exigiria dados rotulados, resolucao adequada, georreferenciamento e validacao. Em um mes, o escopo viavel e sobrepor dados existentes a uma imagem aerea fornecida, nao treinar um modelo proprio.

### IA: recomendado como explicacao e priorizacao inicialmente

O diferencial mais viavel e usar IA para resumir dados ja calculados, explicar a evidencia, comparar periodos e sugerir perguntas para a equipe. O sistema deve enviar para o modelo apenas indicadores e registros selecionados, nunca depender de uma resposta livre para calcular severidade. Toda recomendacao agronomica deve ser marcada como apoio e passar por validacao do responsavel tecnico.

## Plano de execucao em quatro semanas

### Semana 1 - Fundacao dos dados

- Fechar dicionario de dados, chaves e regras de limpeza.
- Normalizar datas, numeros, `nan`, nomes de pragas e geometrias.
- Validar duplicidades e associacoes entre armadilhas, eventos e pragas.
- Definir contratos para cards, serie temporal, mapa, alerta e detalhe.
- Remover a dependencia conceitual de valores fixos do dashboard.

### Semana 2 - Monitoramento de pragas e fotos

- Substituir cards e donut por agregacoes dos CSVs.
- Implementar filtros compartilhados.
- Criar tendencia temporal e comparacao de armadilhas.
- Implementar mapa de armadilhas.
- Implementar detalhe com galeria e evidencia visual.

### Semana 3 - Operacao e contexto

- Criar regras transparentes de alertas.
- Integrar clima ao contexto das ocorrencias.
- Integrar fertilizacao e pulverizacao com mapa e resumo.
- Integrar alertas de maquina e motivos de parada.
- Adicionar catalogo de pragas e danos.

### Semana 4 - Diferencial e fechamento

- Entregar “prova em tres camadas”.
- Adicionar comparador e anomalias simples se o P0 estiver estavel.
- Validar uma imagem aerea fornecida, sem inferencia automatica de praga.
- Testar com usuario, ajustar textos e thresholds.
- Documentar limitacoes, origem dos dados e proximos experimentos de IA.

## Fora do escopo do primeiro mes

- Treinar um modelo proprio de deteccao de pragas.
- Prometer identificacao confiavel de doencas por foto sem dataset rotulado.
- Fazer prescricao automatica de defensivo, dose ou janela de aplicacao.
- Construir um mapa de produtividade sem dado de produtividade associado aos talhoes.
- Processar imagens aereas para detectar pragas sem imagem, resolucao e rotulos adequados.
- Criar previsao agronomica causal a partir de correlacoes de clima e captura.
- Integrar notificacoes de producao, autenticacao completa ou backend de tempo real sem uma fonte de API definida.

## Decisoes e riscos a validar antes de iniciar

- Confirmar se as URLs de imagens S3 permanecem acessiveis no ambiente de demonstracao.
- Confirmar o significado de `pestCount` versus a contagem detalhada em `detection`.
- Confirmar como `plot` e `plotName` devem ser relacionados aos talhoes exibidos.
- Confirmar os limiares de `LOW`, `ALERT`, `CONTROL` e `DAMAGE` com um responsavel tecnico.
- Confirmar a faixa aceitavel de pressao de pulverizacao e a unidade usada no negocio.
- Confirmar se geometrias WKT estao sempre em longitude/latitude e se todas usam o mesmo sistema de referencia.
- Confirmar o fuso horario do relatorio climatico e dos eventos de armadilha.
- Confirmar autorizacao para exibir coordenadas e imagens da propriedade.

## Resultado minimo demonstravel

Ao final do mes, o usuario deve conseguir selecionar um periodo e uma praga, ver onde ela aparece, abrir a armadilha mais critica, revisar a imagem que sustenta a deteccao, consultar a evolucao recente, entender o contexto climatico e ver quais operacoes ou alertas de maquina podem estar relacionados. Cada informacao deve indicar sua origem e cada recomendacao deve ser explicavel.