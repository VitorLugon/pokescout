# Milestone 3.5 — expansão internacional da base histórica

Implementado e validado em **14/10/2026**. PostgreSQL permanece em **127.0.0.1:55432**. Não foram criados frontend, autenticação, previsões, crawling irrestrito ou sincronização recorrente.

## Plano executado

1. Ler AGENTS.md, README, documentação dos dados/Milestones 2–3 e os contratos, serviços, API e testes existentes. Executar os 53 testes anteriores e salvar uma referência dos registros importados.
2. Escolher explicitamente quatro eventos Labs em América do Norte, Europa e Oceania, incluindo dois Internationals e um Mundial, mais dois eventos asiáticos do site principal. Inspecionar HTML público, duas páginas de perfil e uma página explícita de histórico; baixar no máximo uma lista por evento.
3. Implementar um adaptador Main separado, campos desconhecidos/cobertura parcial, migração não destrutiva, prévia e orçamento cumulativo. Detectar possíveis duplicações sem unir identidades ou certificar participações adicionais.
4. Importar a seleção, testar reimportação e API, comparar os registros anteriores e documentar cobertura comprovada e lacunas.

## Seleção e importação comprovadas

A seleção versionada está em `config/international-sample.json`. Foram **seis novos eventos de fonte**, sem importar outros eventos descobertos nos históricos.

| Fonte / ID | Evento / país anfitrião | Data publicada | Resultados importados | Participantes informados | Listas importadas |
| --- | --- | --- | --- | --- | --- |
| Labs / 0054 / MA | EUIC London / GB | 13–15 fevereiro 2026 | 4010 | 4010 | 1 |
| Labs / 0066 / MA | Regional Melbourne / AU | 23–24 maio 2026 | 959 | 959 | 1 |
| Labs / 0070 / MA | NAIC New Orleans / US | 12–14 junho 2026 | 3752 | 3752 | 1 |
| Labs / 0071 / MA | Mundial San Francisco / US | 28–30 agosto 2026 | 797 | 797 | 1 |
| Main / 569 / divisão desconhecida | Champions League Yokohama / JP | 20 setembro 2026 | **32 publicados** | **aproximadamente 5000** | 1 |
| Main / 567 / divisão desconhecida | Korean League Final Season / KR | 24 maio 2026 | **32 publicados** | 645 | 1 |

Total adicionado: **9.582 resultados e seis listas de 60 cartas** (360 cartas por quantidade). Os quatro arrays Labs têm tantos registros quanto o total informado pela fonte. Isso descreve a cobertura de standings da fonte; não certifica classificação oficial nem importação de todas as listas.

As páginas asiáticas publicam apenas colocações selecionadas. Yokohama tem 24 links de listas entre seus 32 resultados; Coreia tem 27. Não foram criados 5000/645 registros fictícios, recordes 0–0–0, divisões Masters, países ou listas presumidos.

**Obtenção:** todas as páginas foram recuperadas por GET HTTP público normal nesta investigação. A gravação foi executada pelo serviço de expansão com leitores injetados sobre essas capturas completas congeladas, preservando URLs e os timestamps originais de obtenção. Isso evitou baixar novamente as páginas durante a importação e a reimportação. Os leitores padrão do comando usam HTTP público com cache; os mesmos parsers/mapeadores/serviços foram usados na validação. Fixtures versionadas são sanitizadas e algumas contêm apenas linhas representativas, conforme seu manifesto; não foram usadas como se fossem os standings completos da aplicação.

As seis execuções de importação ficaram **PARTIAL**, como esperado: há listas disponíveis além do orçamento de uma por evento; Main também tem cobertura parcial e conclusão não informada. Não houve falha de extração/validação de resultados ou listas nessas seis importações. `fullySynchronized` permanece false. A conclusão do evento é true quando publicada pelo Labs e null nos eventos Main, onde não foi declarada.

## Totais e preservação da base

| Entidade | Antes | Depois |
| --- | --- | --- |
| Torneios/divisões de fonte | 4 | **10** |
| Jogadores internos | 2944 | **11201** |
| Identidades de fonte | 2944 | **11201** |
| Aliases | 2949 | **11210** |
| Resultados / metadados de deck | 3195 | **12777** |
| Listas completas importadas | 3 | **9** |
| Linhas de cartas | 80 | **227** |

As nove listas representam 540 cartas por quantidade. São Paulo, Recife Masters/Seniors e Bogotá continuam na base. Comparações de todas as colunas previamente existentes confirmaram que os quatro torneios anteriores, seus **3195 resultados/decks**, **80 linhas de cartas** e **cinco SyncRuns** foram preservados. As novas colunas são excluídas dessa comparação para não confundir uma extensão de esquema com alteração de dados anteriores.

A propriedade jogador/fonte/escopo/ID externo das **2944 identidades anteriores** também permaneceu inalterada. Timestamps/última evidência de aliases e identidades podem ser atualizados legitimamente quando o mesmo ID Labs aparece num novo torneio; isso não muda a propriedade da identidade nem os resultados anteriores.

A reimportação real dos dois eventos Main salvou novamente seus 32 + 32 resultados, mas manteve todas as contagens, IDs de cartas e listas existentes. O orçamento foi zero para listas já importadas. Um teste PostgreSQL adicional repete a operação com o mesmo manifesto e verifica esse comportamento, inclusive com divisão null.

## Histórico internacional e consultas

A agregação por ID estável **dentro do Labs** já permite consultar históricos em diferentes regiões. Como exemplo observado na base, a identidade de fonte exibida como **Cerys Jones** tem cinco resultados em eventos anfitriões de **AU, BR, GB e US**. Esses códigos descrevem os países dos eventos, não a nacionalidade da pessoa. Não houve união por nome entre fontes para produzir esse histórico.

Main usa namespace `limitless-main`, separado de `limitless-labs` e `limitless-api`/Play. O perfil 7427 informa cinco resultados públicos de temporadas coreanas; o perfil 15369 fornece outro exemplo japonês. O perfil resumido e a página `/results` podem ordenar os mesmos registros de maneiras diferentes. O adaptador retorna a ordem observada e não afirma conhecer toda a carreira. Os outros eventos encontrados nesses históricos não foram importados automaticamente; apenas o evento selecionado foi persistido nesta amostra.

Consultas reais pelo `ScoutQueryService` e pela API Fastify existente foram verificadas com PostgreSQL da aplicação. Um servidor HTTP temporário, limitado a loopback e porta efêmera, respondeu **200** em `/health`, `/tournaments`, busca por Jooho, histórico de seu jogador interno Main e consulta de sua lista. A lista retornou 60 cartas; W/L/T e divisão desconhecidos continuaram null. O servidor de verificação foi encerrado e não alterou a porta do PostgreSQL ou a configuração da API.

## Qualidade, formatos e duplicações

- `resultsCoverage` distingue `COMPLETE_STANDINGS`, `PUBLISHED_RESULTS` e `UNKNOWN`. O contador `reportedPlayerCount` não é confundido com o número de linhas efetivamente publicadas.
- Divisão, temporada, pontos, vitórias/derrotas/empates, desclassificação e conclusão podem ser null. O importador preserva valores válidos anteriores quando a fonte omite um campo; não preenche lacunas com zero ou dados do anfitrião.
- A data original permanece em `dateLabel`. `eventDate` é uma data de calendário quando analisável, sem hora/fuso inventado. Timestamps de atualização sem fuso permanecem nos dados brutos.
- Os dois eventos Main têm o rótulo **standard-jp**, preservado literalmente. A nota coreana menciona expansão e promos adicionais. Isso não é convertido para Standard ocidental. O tamanho de 60 cartas foi validado explicitamente na seleção, sem criar equivalência entre formatos.
- País anfitrião e país da linha do jogador são independentes. A página coreana inclui jogadores com JP na linha; isso permaneceu JP num evento KR.
- Nomes originais Unicode e IDs/URLs de fonte são preservados. Normalização/semelhança romanizada serve para revisão; não existe transliteração que una automaticamente identidades. O teste com escrita japonesa é uma mutação sintética identificada como tal, não uma alegação de que o site forneceu aquele nome em kanji.
- Cartas preservam quantidade, nome, set, número e idioma representados no HTML. O idioma inglês renderizado e a versão regular escolhida pelo site não comprovam o idioma/printing físico originalmente utilizado.

`TournamentDuplicateCandidate` e `ResultDuplicateCandidate` guardam apenas **possíveis** sobreposições, com referências das duas fontes. A detecção usa links explícitos ou data inicial/país/título compatíveis; dentro de um evento candidato, nome normalizado e colocação compatível são indícios para revisão. Não há fusão nem confirmação automática. Variações de datas/nomes ou transliterações diferentes podem escapar desses sinais conservadores.

Foi inspecionada também a representação **Main 515** do mesmo Mundial selecionado no Labs. Ela coincide em país/data/categoria do título e nome/colocação do vencedor, mas tem IDs próprios. Essa representação alternativa foi usada em fixtures e testes PostgreSQL isolados para provar a detecção. **Não foi importada na aplicação e não teve outra lista baixada.** Assim, os seis registros de fonte selecionados não sobrepõem eventos entre fontes nesta base: há **zero candidatos persistidos** na aplicação, sem alegar ausência geral de duplicações no catálogo.

Históricos mantêm `total` como número de resultados publicados de fonte, com `totalMeaning=published-source-results` e `confirmedParticipationCount=null`. Resultados e torneios expõem seus candidatos; comparações de identidade mostram possíveis sobreposições de eventos. Representações candidatas nunca viram participações adicionais confirmadas só porque existem duas linhas.

## Implementação e comandos

- Adaptador separado `packages/data-sources/src/limitless-main`: cliente, parser puro, mapper, tipos, carregamento de histórico público e vínculo lista–entrada do evento explicitamente carregado.
- Cliente HTML público compartilhado: allowlist de origem/caminho, sem credenciais, redirects recusados, timeout/tamanho máximo, cache em memória de uma hora e nenhum retry. Espaçamento mínimo Labs 1,1 s; Main 1,3 s.
- Migração `202610140003_international`: novas colunas/tabelas e ampliação para null, sem apagar resultados anteriores. Unicidade e exclusão de jobs usam `NULLS NOT DISTINCT` para divisão desconhecida. As restrições anteriores de quantidades/recordes não negativos continuam válidas.
- `HistoricalExpansionService`: manifesto explícito de até seis eventos e orçamento acumulado de até uma lista/evento, rechecado com a exclusão RUNNING adquirida. Prévia sem HTTP; falha interrompe o lote. Limites esperados de cobertura/listas produzem PARTIAL.
- Histórico/listagem/API reutilizam os serviços existentes; não há HTTP externo nas rotas.

```powershell
pnpm db:migrate
pnpm scout:expand
pnpm scout:expand --apply
pnpm scout:main-history --player 7427 --results-page
pnpm scout:search --name "Jooho Koh"
pnpm scout:history --player <UUID-retornado-na-busca>
```

A seleção pode ser substituída com `--manifest caminho.json`, mantendo os limites. Não é um comando para percorrer o catálogo. O importador Labs anterior e sua reconciliação permanecem disponíveis. Reconciliação/refresh Main pelo comando do Milestone 3 continua explicitamente não suportado; essa extensão exige tratar o vínculo de listas ao evento com o mesmo cuidado do novo adaptador.

## Validações executadas

- **53 testes anteriores preservados**, executados com sucesso antes das alterações.
- **41 testes offline aprovados** ao final: 28 anteriores + 13 novos de fonte internacional, HTML parcial, Unicode, formatos, histórico, duplicações, cliente e limites.
- **30 testes PostgreSQL aprovados**: 25 anteriores + cinco novos de importação parcial, preview/orçamento/reimportação, duplicações com proveniência/API, interrupção e consultas asiáticas.
- **71 testes no total**; testes comuns não dependem de websites externos.
- TypeScript aprovado; migração aplicada ao banco existente e novamente aos schemas isolados dos testes.
- Prévia CLI executada sem consultas à fonte; parser/cliente/listas validados com capturas públicas e fixtures sanitizadas.
- Auditoria de preservação, reimportação Main sem duplicações e verificações HTTP reais locais aprovadas.
- Prova offline original permanece disponível e foi verificada.

## Cobertura comprovada versus planejada

**Comprovada:** seis eventos selecionados, anfitriões GB/AU/US/JP/KR, dois Internationals e Mundial, 9582 novos resultados e uma lista/evento, além dos quatro registros latino-americanos mantidos em BR/CO. Há um histórico Labs consultável abrangendo diferentes regiões e dois exemplos de históricos públicos Main analisados. Isso demonstra os caminhos de dados, não cobertura universal.

**Ainda não comprovada/planejada:** cobertura nacional completa em qualquer país; outros países asiáticos, China/Taiwan/Sudeste Asiático, outros eventos de Japão/Coreia; África e Oriente Médio; todos os Seniors/Juniors; carreiras completas; standings completos asiáticos; todos os decks/listas; estabilidade futura do HTML/API, acordo de limites de produção, revisões oficiais, equivalência regional de formatos e printing físico. Os códigos de país de jogadores internacionais não comprovam cobertura de eventos nesses países.

Próximo passo recomendado: revisão de candidatos de identidade/evento e extensão controlada para mais fontes/eventos asiáticos, com evidência de cobertura/divisão/formato; depois validar refresh Main. Não ampliar a coleta nem adicionar previsões enquanto essas diferenças permanecerem sem resolução.
