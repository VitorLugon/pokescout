# Milestone 6 — resumo histórico de arquétipos e filtros de scouting

Implementado sobre o Milestone 5, usando apenas dados já importados. Não foram adicionados imports, previsões, IA, fusões, autenticação ou sincronização recorrente. PostgreSQL permanece em **127.0.0.1:55432**. Nenhuma migração ou dependência nova foi necessária.

## Plano e fluxo

1. Ler as instruções, documentação, contratos e código existentes. Executar os **99 testes anteriores** e TypeScript antes das alterações. Salvar hashes dos registros da aplicação.
2. Criar contratos e serviço de resumo/evidências, centralizando validação, elegibilidade, filtros e denominadores.
3. Acrescentar ao histórico a entrada **Arquétipos publicados e filtros**, com resumo, filtros recolhíveis, grupos e evidências paginadas. Reutilizar o cartão de resultado e a API de listas existentes.
4. Testar o conjunto completo, intervalos inclusivos, taxonomia, desconhecidos, duplicações e preservação de estado com fixtures e PostgreSQL isolado; verificar leituras reais e layouts mobile.

O histórico original continua disponível. O novo recorte usa `#/player/:id/scouting`; listas e detalhes de candidatos abrem sob esse caminho. A identidade, os filtros aplicados, o grupo e a página permanecem montados ao abrir/voltar de uma lista ou proveniência. Voltar ao histórico original e reabrir o resumo da mesma identidade também conserva o estado durante essa navegação. Recarregar a página ou abandonar a identidade não persiste a consulta em armazenamento local.

## Unidade de análise e denominadores

A unidade é **um resultado publicado de fonte associado ao UUID da identidade selecionada**. A consulta não segue outros candidatos nem revisões SAME_PERSON. Nenhuma contagem significa participações físicas únicas confirmadas ou carreira completa.

Sequência da análise:

1. Carregar toda a projeção histórica da identidade, sem limite de página, cartões completos ou snapshots brutos.
2. Aplicar formato/divisão literais.
3. Aplicar os limites de período, quando presentes; contabilizar datas desconhecidas excluídas neste ponto.
4. Aplicar o estado de data conhecido/desconhecido.
5. Separar resultados sinalizados por candidatos de duplicação.
6. Agrupar somente os elegíveis com arquétipo conhecido; manter os desconhecidos contados e consultáveis.

| Campo | Significado |
| --- | --- |
| `availableResults` | Todos os resultados da identidade, antes de qualquer filtro. |
| `matchingResults` | Resultados que atendem a todos os filtros. |
| `excludedUnknownDateByPeriod` | Resultados com data desconhecida após formato/divisão, excluídos porque há limite de período. Não fazem parte de matchingResults. |
| `excludedPossibleDuplicates` | Resultados filtrados sinalizados por pelo menos um candidato de resultado ou evento. |
| `eligibleResults` | matchingResults menos excludedPossibleDuplicates. |
| `knownArchetypeResults` | Elegíveis com ID de arquétipo ou rótulo literal não vazio. |
| `unknownArchetypeResults` | Elegíveis sem ambos; eligibleResults menos knownArchetypeResults. |

Para cada grupo conhecido:

```text
denominador = knownArchetypeResults
percentual = round(contagemDoGrupo × 1000 / denominador) / 10
```

O denominador é sempre explícito na tela: “12 de 15 resultados elegíveis com arquétipo conhecido”. O arredondamento é de uma casa decimal; três grupos de um resultado podem somar 99,9%. Não há percentual quando o denominador é zero. Ausência de resultados e resultados elegíveis apenas com arquétipo desconhecido têm estados separados. Desconhecidos nunca são redistribuídos entre grupos nem apagados.

O resumo usa todo o recorte no banco, independentemente da página de dez evidências. A lista de grupos também não é calculada pelo React. Os exemplos de evento por grupo são limitados a três registros, com total e truncamento explícitos; todas as evidências permanecem acessíveis com paginação.

## Identidade, taxonomia e duplicações

As chaves de grupo são JSON de `[fonteDoDeck, "id", idDeArquétipo]`. Sem ID não vazio, usam `[fonteDoDeck, "label", rótuloOriginal]`, sem normalizar acentos, caixa, espaços ou caracteres Unicode. Ausência de ID e rótulo usa a chave reservada `unknown`. As chaves conhecidas começam como arrays JSON e não colidem com essa chave.

IDs diferentes com o mesmo nome continuam separados; fontes diferentes com o mesmo ID também. Um ID estável pode ter diferentes rótulos publicados: eles são preservados em `labels`. O nome principal vem do primeiro resultado na ordem de data de calendário conhecida decrescente, com ID interno como desempate; datas desconhecidas ficam depois. Isso não altera a taxonomia da fonte.

O recorte “todos os formatos” pode combinar resultados publicados sob regras diferentes; agrupar pelo mesmo ID da fonte não declara equivalência de formatos ou legalidade de listas. A interface permite filtrar cada rótulo literal separadamente, inclusive `standard-jp`.

Um resultado é excluído se possuir candidato em qualquer lado de `ResultDuplicateCandidate` **ou** seu torneio possuir candidato em qualquer lado de `TournamentDuplicateCandidate`. Vários sinais no mesmo resultado contam como **uma exclusão**, não várias. A regra é conservadora e obrigatória para as frequências desta versão; não confirma duplicação, não remove linhas e não resolve a identidade. A ação “Ver possíveis duplicações” permite inspecionar os resultados excluídos e abrir as proveniências já implementadas.

## Filtros e datas

| Parâmetro | Semântica |
| --- | --- |
| `from`, `to` | Dia ISO `YYYY-MM-DD`, cada limite opcional e inclusivo; quando ambos existem, from ≤ to. |
| `dateState` | `all` (padrão), `known` ou `unknown`. |
| `formatMode`, `divisionMode` | `all` (padrão), `known` ou `unknown`. |
| `format`, `division` | Valor literal opcional, permitido somente com o modo `known`. Known sem literal inclui todos os valores informados; unknown seleciona null. |

Datas usam exclusivamente `eventDate` válido, sem extrair dia de `season`, `startsAt`, ID ou `dateLabel`. A validação verifica calendário real, incluindo anos bissextos; null e valores inválidos são desconhecidos para análise. A data publicada `dateLabel` permanece na apresentação. Não se inventa fuso horário: UTC é usado apenas para validar componentes do calendário.

Sem intervalo, datas desconhecidas permanecem no recorte padrão. Com qualquer limite de período, são excluídas e contadas depois dos filtros de formato/divisão. Combinar `dateState=unknown` e limite de período é inválido. A interface limpa/desabilita os campos de intervalo ao escolher apenas datas desconhecidas. Formatos e divisões são opções devolvidas para toda a identidade, sem inferir Masters ou Standard para null.

Os filtros são editados como rascunho e aplicados por botão, evitando consultas por tecla. Há botão para limpar e estado explícito do recorte aplicado. Alterações de filtros reiniciam o conjunto/página de evidências. Respostas antigas são canceladas/ignoradas pelo hook existente.

## API e consistência

| GET | Resposta |
| --- | --- |
| `/players/:id/scouting` | `ScoutingSummary`: identidade, filtros, opções, contagens, grupos, unidade, revisão e computedAt. |
| `/players/:id/scouting/evidence` | `ScoutingEvidence`: mesmo pipeline, resultados projetados e paginação. |

Ambos aceitam os filtros acima. Evidências aceitam também:

- `scope=eligible` (padrão), `duplicates` ou `matched`.
- `group`: chave do resumo ou `unknown`, permitida somente com scope eligible. Chave sem correspondência resulta em conjunto vazio, sem criar arquétipo.
- `limit`: 1–100, padrão 10; `offset`: 0–100000, padrão 0.

Literais de formato/divisão têm máximo 200 caracteres; group tem máximo 2000. UUID, calendário, combinações de parâmetros e limites são validados no serviço e nas rotas. Parâmetros desconhecidos são recusados. Erros de entrada retornam 400, identidade inexistente 404 e falhas inesperadas um 500 sem detalhes de banco. Apenas GET/HEAD estão disponíveis.

Cada requisição lê jogador/resultados em transação `RepeatableRead`. Resumo e evidências usam a mesma função pura de análise, e só depois se aplica a paginação. As respostas omitem raw, upstreamIds e cartas completas; a lista histórica continua no endpoint próprio existente.

`revision` é SHA-256 da projeção histórica relevante, com ordem determinística de resultados e IDs de candidatos. Ela não depende dos filtros ou da página. `computedAt` é o horário local de cálculo do resumo, não uma data de torneio ou nova obtenção na fonte. Requisições distintas não congelam o banco indefinidamente: se alguma importação mudar a revisão entre resumo e evidências, a interface oculta as linhas incompatíveis e oferece “Atualizar recorte”. Não há cache persistente de análise nem novo snapshot no banco.

## Execução

```powershell
# PostgreSQL existente ligado, sem novos imports/migrações:
pnpm api:start
# Outro terminal:
pnpm web:dev
# Abrir http://127.0.0.1:5173
```

Reinicie uma API iniciada antes destas alterações. O proxy/configuração do Milestone 4 permanece: API em 3001, frontend em 5173, PostgreSQL em **55432**, sem segredos em VITE_* ou CORS irrestrito. `pnpm web:build` gera o bundle e `pnpm web:preview` o serve em 4173, com a API local ligada.

## Validações e evidências

```powershell
pnpm test
pnpm test:db
pnpm typecheck
pnpm web:build
pnpm scout:proof
$env:PLAYWRIGHT_CHANNEL='msedge'
pnpm test:web
# API/PostgreSQL reais e imports existentes:
$env:POKESCOUT_LIVE_API='1'
pnpm test:web
Remove-Item Env:POKESCOUT_LIVE_API
```

Chromium padrão pode ser instalado com `pnpm --filter @tcg-scout/web exec playwright install chromium`; esta máquina usou Edge headless. Testes simulados e reais são executados em grupos separados, com o modo real opt-in.

- **52 testes offline**: 44 anteriores + oito de validação/API e análise de denominadores completos, desconhecidos, namespace/IDs/rótulos, arredondamento, datas inclusivas e inválidas, formatos regionais e duplicações contadas uma vez.
- **36 testes PostgreSQL**: 33 anteriores + três de histórico completo além da primeira página, SAME_PERSON sem agregação, evidências reconciliáveis, filtros/unknowns, ausência de raw/cards, mudança de revisão e exclusão conservadora com proveniência.
- **27 testes de navegador com fixtures**: 19 anteriores + oito de denominadores fora da página, filtros/limpeza/valores desconhecidos, grupo/paginação/lista/voltar, duplicações consultáveis, erros/retry/revisão divergente, respostas antigas, ausência de denominador e layout/teclado.
- **Quatro testes de navegador com API/PostgreSQL reais**: três anteriores + fluxo de Jooho Koh com resumo, dia inclusivo, formato standard-jp, divisão desconhecida, evidência de grupo e lista importada de 60 cartas; retorno preserva filtros. O teste também verifica consistência do histórico multievento de Cerys Jones.
- **119 testes no total**, preservando os 99 anteriores. TypeScript backend/frontend, build de produção e prova offline aprovados.

As primeiras falhas dos testes novos de navegador estavam nos rótulos acessíveis exatos de selects e na identificação do link de retorno. Rótulos e navegação foram corrigidos; os oito testes novos e depois as suítes completas foram repetidos.

**Dados reais conferidos:** Cerys Jones tem cinco resultados elegíveis conhecidos, sem exclusões candidatas nesta base: Alakazam Dudunsparce 2/5 (40%), Dragapult Dusknoir 2/5 (40%) e Gardevoir 1/5 (20%). Isso descreve somente os cinco resultados importados dessa identidade. Jooho Koh Main tem um resultado conhecido elegível no evento coreano e uma lista existente; 1/1 não significa probabilidade do deck futuro.

**Casos sintéticos/isolados:** histórico de 25 resultados para provar agregação além da página; Unknowns, campos japoneses sintéticos, formatos diferentes, datas inválidas/desconhecidas, revisões SAME_PERSON e candidatos de duplicação. Não foram gravados no schema da aplicação. As capturas públicas anteriores de Mundial Labs/Main foram reutilizadas localmente para exercitar exclusões, sem novo acesso à fonte.

Layouts conferidos em **320 e 390 px**, sem rolagem horizontal nos fluxos verificados, com filtros recolhíveis, foco e teclado. Capturas ignoradas pelo Git: `.cache/milestone-6-overview-{320,390}.png`, `milestone-6-counts-{320,390}.png`, `milestone-6-groups-{320,390}.png`, `milestone-6-real-counts-{320,390}.png` e `milestone-6-real-groups-{320,390}.png`. A verificação usa navegador emulado, não aparelho físico ou auditoria completa de acessibilidade.

Hashes SHA-256 das **12 tabelas da aplicação**, com todas as linhas ordenadas por ID, foram comparados antes/depois das leituras e coincidiram. Permanecem 11.201 jogadores/identidades, 11.210 aliases, dez torneios/divisões, 12.777 resultados/decks, 227 linhas de cartas, nove listas e 13 SyncRuns. Não foram adicionadas revisões ou candidatos fictícios. Auditoria ignorada em `.research/m6-before.json` e `.research/m6-audit.mts`.

## Arquivos e limites

Criados:

- `packages/shared/src/scouting-contracts.ts`.
- `packages/application/src/scouting-query.ts`, `scouting-analysis.ts` e `scouting-filters.ts`.
- `packages/application/test/scouting.test.ts` e `apps/api/test/scouting.test.ts`.
- `apps/web/src/Scouting.tsx`, `ScoutingFilters.tsx` e `ResultCard.tsx` (cartão extraído/reutilizado).
- `apps/web/test/scouting-fixtures.ts` e `scouting.spec.ts`.
- `docs/milestone-6.md`.

Alterados:

- Exports em `packages/shared/src/index.ts` e `packages/application/src/index.ts`.
- `apps/api/src/app.ts` e `server.ts`.
- `packages/database/test/synchronization.test.ts`, com casos anteriores preservados.
- `apps/web/src/api.ts`, `App.tsx`, `History.tsx`, `Decklist.tsx`, `presentation.ts` e `styles.css`.
- `apps/web/test/live.spec.ts`, mantendo os três casos anteriores.
- README e documentação de arquitetura.

Sem mudanças em adapters, schema, migrations, dependências ou lockfile. Limitações: cobertura regional continua amostral; exclusões podem remover evidências que futuramente sejam consideradas distintas; agrupamento literal sem ID pode fragmentar sinônimos; percentuais dependem da publicação/importação e do recorte escolhido. A análise lê a projeção completa de uma identidade em memória no servidor; não é uma solução de agregação global ou escala ilimitada. Não há unificação de taxonomias, previsão, probabilidade, IA ou atualização automática.
