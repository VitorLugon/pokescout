# Milestone 5 — comparação de identidades e qualidade do histórico

Implementado sobre o Milestone 4 em 14/10/2026. Interface e API consultam apenas dados já importados. **Nenhuma migração, nova coleta, avaliação fictícia ou fusão foi aplicada à base da aplicação. PostgreSQL permanece em 55432.**

## Plano executado

1. Ler AGENTS.md, pedido, README, arquitetura, fontes, Milestones 3/3.5/4 e contratos/serviços/frontend. Executar os 83 testes anteriores e TypeScript antes das alterações.
2. Preservar o endpoint de inspeção existente e acrescentar uma projeção resumida para comparação mobile, incluindo arquétipos, revisão e truncamento. Criar consultas GET de um par candidato de duplicação, sem dados brutos desnecessários.
3. Implementar seleção de duas identidades, comparação em cartões, avaliações independentes e detalhes de ambas as proveniências. Explicar cobertura da fonte versus completude da importação.
4. Validar com fixtures sintéticas, PostgreSQL em schema isolado e leituras na API real. Conferir layouts de 320/390 px e comparar hashes das tabelas da aplicação.

## Interface

Na busca, cada candidato oferece um checkbox. A seleção mostra nome, fonte e ID e aceita no máximo dois candidatos. O botão de comparar só habilita com exatamente dois. É possível remover candidatos e mudar a consulta para selecionar identidades de fontes ou nomes diferentes. A busca/seleção permanece montada ao navegar; voltar pelo aplicativo ou navegador preserva o estado. Não há persistência da seleção após recarregar a página.

`#/compare/:a/:b` mostra cartões empilhados, nunca uma tabela larga. Cada identidade mantém aliases originais, fonte/ID/escopo, URLs/timestamps, países informados no recorte, resultados publicados de fonte e arquétipos históricos. Países não são nacionalidade comprovada e não são preenchidos pelo país anfitrião. Null permanece desconhecido. Datas e formatos regionais são apresentados literalmente, inclusive `standard-jp`.

O comparador mantém o limite anterior de **100 resultados por identidade**, em ordem estável de ID interno. Isso é explicado na tela: o recorte não é necessariamente o mais recente nem toda a carreira. Países e sobreposições resumem somente esse recorte. `historyTruncated` existe globalmente e por identidade. Não se somam os históricos como participações únicas.

Nomes normalizados coincidentes são somente indícios. Resultados no mesmo registro de evento recebem um aviso explícito; não provam identidade. Os pares candidatos entre fontes mostrados na comparação são filtrados pelo serviço para envolver resultados de ambas as identidades selecionadas, sem incluir automaticamente candidatos de eventos de terceiros.

## Avaliações registradas

As decisões SAME_PERSON, DIFFERENT_PEOPLE e UNCERTAIN aparecem como avaliações, com justificativa, revisor, data e links públicos. Revisores são rótulos locais sem autenticação. Texto é renderizado pelo React como texto, sem HTML arbitrário. Links só aceitam HTTP(S) sem credenciais, com `noopener noreferrer`.

O serviço informa total, limite **50** e truncamento das revisões. Decisões SAME_PERSON e DIFFERENT_PEOPLE contraditórias **no recorte retornado** geram aviso. Nenhuma avaliação é promovida a verdade definitiva pela data; todas as recebidas são exibidas. Revisões além do limite não são carregadas automaticamente e podem conter outras divergências; o truncamento permanece explícito.

Mesmo SAME_PERSON não une jogadores, não altera identificadores, não redireciona candidatos nem agrega históricos. A interface não grava revisões. O CLI existente `pnpm scout:identity` continua sendo o mecanismo de registro; nenhuma avaliação foi adicionada à aplicação para demonstrar a interface.

## Duplicações e cobertura

Os avisos do histórico abrem `#/player/:playerId/duplicate/{event|result}/:candidateId`; a comparação também oferece detalhes de pares de eventos em `#/compare/:a/:b/duplicate/event/:candidateId`. O histórico/comparação fica montado enquanto o detalhe está aberto. Voltar mantém o contexto e a paginação do histórico.

Cada detalhe apresenta as duas representações de fonte, IDs externos separados, URLs, timestamps de obtenção, nome/data/país anfitrião/divisão/formato e cobertura. Para resultados, mostra também nome, ID de resultado, país informado para o jogador, colocação e arquétipo. Um resultado candidato pode abrir seu par de eventos relacionado. Não se listam automaticamente todos os resultados de um evento.

Sinais de detecção são projetados de uma allowlist estrutural: apenas a lista de strings `signals`, com no máximo **20 sinais de 200 caracteres**. Outros JSONs de evidência não são expostos. Códigos conhecidos ganham rótulos; desconhecidos aparecem como texto. A data da detecção é distinta da data de obtenção. Os campos das representações mostram os registros importados atuais e podem diferir do momento da detecção; essa limitação aparece no detalhe.

Os dois tipos de candidato permanecem POSSIBLE, com `confirmedSamePerson=false` e `confirmedAdditionalParticipation=false`. Nenhum dado é removido ou deduplicado. Nomes, datas e países incompletos podem causar omissões na detecção; ausência de candidato não prova ausência de duplicações.

Uma explicação expansível no histórico e nas evidências diferencia:

- Standings completos publicados pela fonte, sem certificar classificação oficial.
- Resultados selecionados e cobertura desconhecida da fonte.
- Importação local parcial, inclusive quando standings da fonte são completos.
- Arquétipo conhecido versus lista disponível, pendente, ausente, importada ou falha de extração.
- Lista válida anterior preservada após falha de atualização.

Não se exibem percentuais inventados, completude de carreira ou conhecimento do deck atual.

## Contratos e endpoints

| Endpoint GET | Contrato e limites |
| --- | --- |
| `/identity-reviews/compare?playerAId=UUID&playerBId=UUID&view=summary` | Projeção `IdentityComparison`: duas identidades distintas, até 100 resultados por identidade e 50 revisões, totais/truncamento explícitos; sem raw/evidence snapshots ou listas completas de cartas. |
| Mesmo endpoint, sem `view` | Resposta de inspeção anterior preservada; adições compatíveis incluem arquétipo e total de revisões. O frontend usa summary. |
| `/duplicate-candidates/event/:id` | Um par candidato, exatamente duas projeções de torneio, sinais limitados e limitações. |
| `/duplicate-candidates/result/:id` | Um par candidato, duas projeções de resultado/torneio e ID do par de eventos relacionado. |

UUIDs, tipo de candidato e parâmetros são validados; entradas inválidas retornam 400, identidades/candidatos inexistentes 404 e falhas inesperadas um 500 genérico. Query strings não reconhecidas são recusadas. Não há endpoints de escrita, detecção ou sincronização. O factory da API mantém compatibilidade com consumidores anteriores; o launcher registra o novo serviço de detalhes.

`IdentityReviewService.compareForDisplay` e `DuplicateQueryService` concentram projeção e interpretação. Rotas permanecem finas. `evidence.ts` usa selects explícitos e mapeadores que não vazam campos extras de objetos completos. Todos os timestamps da projeção são strings ISO. Os contratos ficam em `packages/shared/src/evidence-contracts.ts`; React apenas apresenta os estados e evidências recebidos.

## Execução e validação

```powershell
# Terminais separados, PostgreSQL existente ligado:
pnpm api:start
pnpm web:dev
# Abrir http://127.0.0.1:5173

pnpm test
pnpm test:db
pnpm typecheck
pnpm web:build
pnpm scout:proof

# Chromium instalado pelo Playwright, ou Edge local usado nesta validação:
$env:PLAYWRIGHT_CHANNEL='msedge'
pnpm test:web
# Smoke somente leitura, API real ligada e imports anteriores presentes:
$env:POKESCOUT_LIVE_API='1'
pnpm test:web
Remove-Item Env:POKESCOUT_LIVE_API
```

A configuração de API/proxy do Milestone 4 permanece: `VITE_API_BASE_URL=/api`, destino local `API_PROXY_TARGET=http://127.0.0.1:3001`, sem CORS irrestrito ou segredos no frontend. Reinicie um processo de API iniciado antes destas alterações. Para usar Chromium, instale uma vez com `pnpm --filter @tcg-scout/web exec playwright install chromium`. O build fica em `apps/web/dist` e `pnpm web:preview` permite conferi-lo em 4173. A validação mobile usa navegador emulado, não aparelho físico.

Resultados:

- **44 testes offline**: 41 anteriores + três de API/projeção, validação, sanitização de erros, limites de sinais e ausência de snapshots brutos.
- **33 testes PostgreSQL**: 30 anteriores + três de comparações/revisões contraditórias/Unicode/campos desconhecidos, truncamento 100/50 e detalhes de duplicação com duas fontes/404/filtro de sobreposição. Migrations existentes aplicadas apenas ao schema isolado dos testes; nenhuma nova migração.
- **19 testes de navegador com fixtures**: dez anteriores + nove de seleção/remoção/exatamente dois, voltar/consulta preservada, evidências internacionais, erros/retry/vazio, respostas antigas, avaliações contraditórias, texto malicioso renderizado sem execução, URLs executáveis recusadas, duplicações e cobertura independente, teclado e layouts de 320/390 px.
- **Três testes de navegador com API/PostgreSQL reais**: dois anteriores + um comparando os IDs Labs 5391/57170 de Francisco Osorio e depois uma identidade Labs com a Main 7427 de Jooho Koh, sem agregação. Todas as chamadas do fluxo são GET.
- **99 testes ao todo**, preservando os 83 anteriores. Os grupos simulado e real são executados separadamente; o modo real é opt-in.
- TypeScript backend/frontend, build de produção e prova offline aprovados. As primeiras falhas dos novos testes de navegador eram seletores ambíguos por texto repetido ou telas anteriores ocultas; foram corrigidos restringindo a consulta à seção apropriada e os testes foram repetidos.
- Capturas conferidas em 320 e 390 px, sem rolagem horizontal nos fluxos verificados. Alvos e foco de teclado permanecem utilizáveis. Não se alega uma auditoria completa de acessibilidade.

As capturas ficam em `.cache/milestone-5-comparison-{320,390}.png`, `milestone-5-player-{320,390}.png`, `milestone-5-reviews.png`, `milestone-5-duplicate-{320,390}.png` e `milestone-5-real-comparison-{320,390}.png`. Traces de falhas ficam no diretório já ignorado `.cache/web-test-results`.

## Evidência real versus sintética e preservação

**Comprovado com imports reais:** seleção, comparação dos dois IDs Labs de Francisco, consulta de fontes diferentes Labs/Main, nomes/aliases/proveniência e retorno à busca, além do fluxo anterior de lista de 60 cartas. A aplicação contém zero revisões e zero candidatos persistidos de duplicação; por isso o vazio é o estado real dessas seções.

**Comprovado com fixtures e PostgreSQL isolado:** revisões SAME_PERSON/DIFFERENT_PEOPLE/UNCERTAIN, contradições, japonês sintético, limites excedidos e detalhes completos de duplicação. A evidência de Mundial Labs/Main já capturada anteriormente foi reutilizada localmente no schema de testes. Não foi importada na aplicação. A fixture de truncamento contém linhas sintéticas para exercer o limite, sem representar uma carreira real. Os testes não dependem de websites externos.

Hashes SHA-256 de todas as linhas, ordenadas por ID, das **12 tabelas da aplicação** foram comparados antes e depois das validações e coincidiram. Permanecem 11.201 jogadores/identidades, 11.210 aliases, dez torneios/divisões, 12.777 resultados/decks, 227 linhas de cartas, nove listas e 13 SyncRuns; zero avaliações/revisões de listas e candidatos de duplicação. Nenhum timestamp ou propriedade de identidade foi alterado pelo fluxo de leitura. Auditoria local ignorada em `.research/m5-before.json` e `.research/m5-audit.mts`.

## Arquivos

Criados:

- `packages/shared/src/evidence-contracts.ts`.
- `packages/application/src/evidence.ts` e `duplicate-query.ts`.
- `packages/application/test/evidence.test.ts` e `apps/api/test/evidence.test.ts`.
- `apps/web/src/Comparison.tsx`, `Duplicate.tsx`, `Evidence.tsx` e `CoverageHelp.tsx`.
- `apps/web/test/evidence-fixtures.ts` e `evidence.spec.ts`.
- `docs/milestone-5.md`.

Alterados:

- `packages/shared/src/index.ts`.
- `packages/application/src/identity-review.ts` e `index.ts`.
- `packages/database/test/synchronization.test.ts` (casos anteriores preservados).
- `apps/api/src/app.ts` e `server.ts`.
- `apps/web/src/api.ts`, `App.tsx`, `Search.tsx`, `History.tsx` e `styles.css`.
- `apps/web/test/live.spec.ts` (dois casos anteriores preservados).
- `README.md` e `docs/architecture.md`.

Sem novas dependências ou mudança no lockfile. Limites remanescentes: comparação por recorte, revisões além de 50 não paginadas, nenhuma resolução definitiva de identidade/eventos, cobertura regional amostral, nenhuma gravação pela interface e contrato local ainda sem versionamento público. Não foram criados previsões, IA, autenticação, pagamentos, crawlers ou sincronização recorrente.
