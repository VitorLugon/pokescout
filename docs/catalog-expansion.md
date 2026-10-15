# Expansão do catálogo e sprites

## Resultado comprovado

Catálogos capturados em 14/10/2026; carga e auditoria concluídas em 15/10/2026 UTC.
As três prévias finais retornaram zero pendências e não há SyncRun em andamento.

| Fonte | IDs de evento na fonte | Registros de evento/divisão | Resultados consultáveis |
| --- | ---: | ---: | ---: |
| Limitless Labs | 76 | 228 (MA/SR/JR) | 147.119 |
| Limitless Main | 540 | 540 | 39.679 |
| Total | 616 referências de fonte | 768 | 186.798 |

As referências de fonte não são uma contagem de eventos físicos únicos. Há
176 pares candidatos de eventos e 19.233 pares candidatos de resultados entre
fontes, sem confirmação automática de identidade ou participação adicional.
O banco contém 73.181 entidades de jogador em seus escopos de fonte; esse número
também não significa pessoas únicas confirmadas.

O Main abrange os eventos publicados de 2010 a 2026. O Labs abrange as temporadas
2025, 2026 e 2027, priorizando 2027/2026. Países/regiões publicados incluem América
Latina, América do Norte, Europa, Oceania, Japão, Coreia, Indonésia, Malásia,
Singapura, Filipinas, Taiwan, Hong Kong, Tailândia e África do Sul, entre outros
códigos listados no relatório. Isso comprova a cobertura dos catálogos capturados,
não todos os eventos realizados no mundo ou todas as participações desses jogadores.

Há 16 páginas Labs sem resultados e um registro adicional com cobertura não
confirmada pela diferença 63/62 em Sydney Juniors. O Main continua com cobertura
parcial de publicação. Sete linhas conflitantes ficam preservadas em quarentena
nos eventos Main 520, 471 e 26. Onze marcadores de plataforma foram separados do
campo de país sem alterar os países dos jogadores nem os timestamps de obtenção.

As nove listas e suas 227 linhas de cartas anteriores foram preservadas; nenhuma
lista nova foi baixada nesta carga. Há 182.183 registros de listas disponíveis na
fonte ainda não importadas (podem incluir representações do mesmo evento).

A auditoria comparou os fingerprints dos torneios, resultados, decks, cartas e
jogadores anteriores, além dos proprietários das identidades de fonte: todos
permaneceram intactos. PostgreSQL continua em `127.0.0.1:55432` com o mesmo volume.
Nenhuma migration de produção foi necessária.

Validação final: 61 testes offline, 41 de PostgreSQL em schema isolado, 30 de
navegador com fixtures e cinco com API/banco reais aprovados (137 casos).
`pnpm typecheck` e `pnpm web:build` aprovados. As unidades não consultam os sites
externos. Os testes reais verificam as 768 linhas do catálogo por paginação e
as listas antigas sem executar imports. As falhas intermediárias de suspensão,
preparação do schema e inicialização foram corrigidas/reexecutadas; os runs
interrompidos continuam auditáveis.

Próxima etapa recomendada: revisão das duplicações/quarentenas e seleção limitada
de listas/refreshes, com auditoria. Não há sincronização recorrente nesta entrega.

A solicitação amplia o escopo amostral das milestones anteriores. A prioridade
é o catálogo público do Labs, temporadas atual/anterior e depois as anteriores;
em seguida, o catálogo do site principal. Os números comprovados da execução
ficam no relatório de cobertura gerado ao final, não no tamanho do catálogo.

## Procedimento reproduzível

```powershell
pnpm scout:catalog --source labs
pnpm scout:import-catalog                         # prévia, sem HTTP
pnpm scout:import-catalog --apply --max-events 76
# Depois de obter os standings Masters, descobrir apenas divisões explicitamente ligadas:
pnpm scout:catalog --source labs-divisions
pnpm scout:import-catalog --manifest config/labs-divisions-catalog.json
pnpm scout:import-catalog --manifest config/labs-divisions-catalog.json --apply --max-events 200

pnpm scout:catalog --source main --max-pages 25
pnpm scout:import-catalog --manifest config/main-catalog.json
pnpm scout:import-catalog --manifest config/main-catalog.json --apply --max-events 250
# Repetir o mesmo comando limitado para retomar os eventos restantes.
pnpm scout:coverage --output docs/catalog-coverage.json
```

Os manifests são seleções explícitas de URLs descobertas em HTML público. Não
há tentativa de adivinhar IDs nem crawler de links arbitrários. O Labs anuncia
76 eventos Masters em três temporadas (2027, 2026 e 2025). O site principal
anuncia 540 eventos em 22 páginas, até o Mundial de 2010. Esses números descrevem
o catálogo capturado em 14/10/2026; não comprovam, sozinhos, importação nem
cobertura de todos os torneios realizados no mundo.

Cada aplicação processa no máximo 250 registros de evento/divisão. HTTP é serial,
com espaçamento mínimo de 1,1 s no Labs, 1,3 s no Main e 1,5 s nos catálogos.
Há timeout, allowlist de origem/caminho, limite de tamanho, rejeição de redirects
e interrupção sem retries após erro. Até quatro transações locais de resultado
podem executar em paralelo; isso não aumenta a concorrência HTTP.

O cache persistente em `.cache/catalog-html` e `.cache/tournament-html` guarda
somente respostas bem-sucedidas, preservando a data de obtenção. É um snapshot
para esta carga histórica, sem atualização automática. Não deve ser confundido
com um mecanismo de atualização de torneios em andamento. Novos snapshots
exigem uma execução deliberada com outro diretório de cache ou revisão do cache.

`SyncRun` permite retomar os eventos cujos resultados ainda não foram gravados
integralmente. `PARTIAL` por limite de listas não força novo download de standings.
O log local `.cache/catalog-import.jsonl` registra cada conclusão. Falhas HTTP,
de estrutura ou de resultado interrompem o lote; runs interrompidos pelo operador
continuam auditáveis e exigem recuperação explícita antes de retomar o mesmo evento.
Não há agendamento, sincronização recorrente ou endpoint HTTP que dispare imports.

Para parar entre eventos com segurança em qualquer terminal, crie o arquivo
`.cache/catalog-import.stop` em outro terminal. O lote termina o evento atual e
para antes do próximo. Remova apenas esse arquivo antes de retomar o mesmo comando.
O CLI também trata SIGINT quando o terminal o entrega ao processo; alguns hosts
encerram toda a árvore imediatamente ao pressionar Ctrl+C. Encerrar o processo à
força ou uma queda de energia pode deixar um
`RUNNING` auditável, que não deve ser liberado sem confirmar que não há importador ativo.

Na execução inicial, uma suspensão do computador expirou três transações de
Milwaukee 2025 Masters. O lote parou e foi retomado pelo snapshot em cache;
o evento voltou a registrar os 1.657 resultados recebidos. O run parcial anterior
permanece como evidência de interrupção local, sem indicar falha do site.

## Cobertura e interpretação

**Labs comprovado ao concluir os lotes:** 76 eventos do catálogo, com páginas
MA/SR/JR para cada um (228 registros de evento/divisão), 147.119 resultados
públicos gravados e 16 páginas de divisão sem resultados, marcadas UNKNOWN.
Todos os manifests Labs terminaram com `remaining:0`. Uma diferença entre
contagem publicada e resultados recebidos permanece registrada em Sydney Juniors.
O detalhe de cada registro, junto da ampliação Main, fica em
[`catalog-coverage.json`](catalog-coverage.json).

Esta carga tem orçamento **zero para novas listas**. As listas anteriores são
preservadas. Arquétipos e disponibilidade/URL de listas vêm dos resultados
publicados; `AVAILABLE` não significa que as cartas já estão no banco.

Main continua com `PUBLISHED_RESULTS`, mesmo que publique um top 8, top 32 ou
outro conjunto de colocações. País do evento e país do jogador permanecem
independentes. Recordes/divisão/temporada desconhecidos continuam nulos. Formatos
do catálogo Main são preservados literalmente, inclusive `standard-jp`; não se
presume equivalência regional ou entre temporadas.

Alguns links anunciados de divisão no Labs retornam metadata com participantes
desconhecidos e um array público vazio. Exemplo verificado: Lima 2026 Seniors.
O adaptador preserva o cabeçalho e `reportedPlayerCount=null`, sem criar jogadores,
com `resultsCoverage=UNKNOWN` e flag raw `publicResultsEmpty`. O checkpoint indica
que essa página foi consultada, sem declarar standings completos ou zero participantes.
O relatório separa registros de cobertura desconhecida dos que contêm resultados.

Há também diferenças entre o contador da fonte e os resultados publicados:
Sydney 2026 Juniors, por exemplo, expõe 62 resultados e informa 63 participantes.
O relatório e a interface mantêm essas contagens separadas; não completam as linhas
ausentes. Códigos de país são literais da fonte, incluindo `UK` e `GB`; sua contagem
não deve ser usada como número de países distintos sem uma normalização explícita.

O Main também usa ícones de local/plataforma com rótulos que não são países.
Nos Players Cup, por exemplo, o marcador público `ptcgo` é preservado em
`eventLocationLabel`, enquanto o país anfitrião permanece nulo. A tela de catálogo
mostra o rótulo separadamente; o país informado de cada jogador não é alterado.
Os registros desta carga que tinham esse marcador no campo de país foram
corrigidos a partir do snapshot, preservando o texto original e a data de obtenção.

**Conflito de perfil verificado em Main 520 (Monterrey):** as colocações 101 e 259
apontam para o mesmo perfil 8549, com arquétipos distintos. As duas linhas são
preservadas integralmente em `Tournament.raw.quarantinedResults`, junto da URL e
data de obtenção do torneio. Elas não criam jogadores/participações no histórico;
não se presume se representam duplicação, erro de perfil ou pessoas diferentes.
Os demais resultados podem ser importados. A API e a tela de catálogo informam
a quantidade em quarentena; o SyncRun registra uma questão de qualidade da fonte.
O detalhe requer revisão; o importador não inventa IDs adicionais para contornar
a colisão nem descarta as linhas silenciosamente.

Possíveis eventos/resultados duplicados entre Labs e Main são candidatos de
revisão, sem fusão de identidades. O resumo histórico continua excluindo essas
evidências conservadoramente. A contagem de registros do catálogo não é uma
contagem de eventos únicos nem de participações confirmadas.

Com mais representações das mesmas competições, a política conservadora já
existente do resumo pode excluir uma parte maior do histórico (inclusive por
candidato de evento). As evidências continuam consultáveis. Resolver ou eleger
representações para estatísticas exige revisão própria; esta carga não confirma
automaticamente equivalências nem relaxa os critérios da Milestone 6.

## Consulta e sprites

A interface `#/tournaments` consulta `GET /tournament-catalog?limit=20&offset=0`.
Todas as páginas do banco ficam acessíveis, sem depender do limite de 100 da
rota antiga `/tournaments`, mantida por compatibilidade. A projeção paginada
omite HTML/raw e informa fonte, divisão, formato, cobertura, proveniência,
quantidade de resultados e aviso de possível duplicação.

Históricos paginados ordenam primeiro pela data de calendário publicada. IDs Main
não são uma sequência cronológica, e temporada/início com timezone podem estar
desconhecidos. IDs entram apenas como desempate estável, sem inventar datas.

O cliente PostgreSQL mantém no máximo cinco conexões e usa limites locais de
15 s para conexão/transação e 10 s para aguardar uma transação. Isso acomoda
leituras do histórico ampliado e inicialização sob carga; não muda o espaçamento
nem os timeouts dos sites externos. A validação final aguarda a API iniciar.

Sprites decorativos aparecem ao lado dos arquétipos e das cartas Pokémon.
A folha local, os aliases e os créditos estão em
`apps/web/public/sprites/README.md`. As posições usam espécies do National Dex;
formas usam ícone representativo da espécie. Não se infere a carta exata e não
se alteram taxonomias ou nomes importados. Nomes desconhecidos ficam sem ícone.
Não há requisição externa de sprite no navegador.

## Arquivos da implementação

- Descoberta/cache: `packages/data-sources/src/catalog.ts`, `disk-cache.ts`,
  `public-http.ts` e exports; fixtures/testes em `packages/data-sources/test/`.
- Adapters existentes: parser/types/mapper Labs para páginas vazias e contagens
  divergentes; parser/types/mapper Main para perfis conflitantes e rótulos de local.
- Carga/retomada: `packages/application/src/catalog-import.ts`, concorrência limitada
  em `tournament-sync.ts`, erro de banco sanitizado em `validation.ts`, CLIs
  `scripts/scout-catalog.ts`, `scout-import-catalog.ts`, `scout-coverage.ts` e
  manifests explícitos em `config/`.
- Persistência: inserção limitada em lotes e atualização idempotente de candidatos
  em `source-duplicates.ts`; limites locais de conexão/transação em
  `packages/database/src/index.ts`, sem mudar o schema de produção.
- Consulta: projeção compartilhada em `query-contracts.ts`, serviço `scout-query.ts`,
  rota de API e página `apps/web/src/Tournaments.tsx` com navegação em `App.tsx`.
- Sprites: `PokemonSprites.tsx`, mapa JSON local, folha/créditos em `public/sprites/`,
  integração em resultados, scouting, comparação e lista; gerador opcional
  `scripts/build-sprite-map.cjs` a partir dos snapshots públicos indicados nos créditos.
- Testes offline, banco e navegador estendem os casos existentes; README,
  arquitetura e `data-sources.md` apontam para este relatório.

Não foi necessário criar migrations, alterar a porta do PostgreSQL, instalar
dependências, implementar autenticação ou previsões. As URLs de catálogo aceitam
somente paginação explícita e limitada; não liberam queries arbitrárias nos clientes.
