# PokéScout — historical tournament data and review tools

Milestones 1–6 provide public Limitless Labs and main-site ingestion, PostgreSQL persistence, conservative player identity review, bounded decklist reconciliation, a local Fastify read-only API and a React mobile historical lookup/comparison interface with filtered archetype summaries. Authentication and predictions are not implemented.

Requirements: Node.js 22.20+, pnpm 11.25 and Docker Desktop with its Linux engine running.

## Expanded catalog and Pokémon sprites

The home page now links to **Consultar torneios importados** (`#/tournaments`),
with pagination through all database tournament/division records. Historical
archetypes and Pokémon card names have local decorative species sprites; unknown
names keep their original text without an invented icon.

The explicitly requested catalog expansion uses `pnpm scout:catalog` and
`pnpm scout:import-catalog`: preview first, bounded/resumable imports, persistent
HTML cache, paced public HTTP and stop on errors. Current/previous Labs seasons
come before older Labs events, followed by the separate Main catalog. New lists
have a zero budget in this bulk pass; previously imported lists remain available.
See [the procedure, scope and limitations](docs/catalog-expansion.md),
[coverage report](docs/catalog-coverage.json) and
[sprite provenance](apps/web/public/sprites/README.md).

## Milestone 6: historical archetypes and scouting filters

Open a player history and choose **Arquétipos publicados e filtros**. This view summarizes the entire selected identity's filtered history, rather than the currently loaded page. Expand the filters to choose inclusive calendar bounds, source format/division literals or unknown values. Unknown dates remain without an interval and are counted as excluded when an interval is required. `standard-jp` remains distinct from `standard`.

The summary exposes matching, duplicate-excluded, eligible, known-archetype and unknown-archetype counts. Percentages use only eligible results with known archetypes, rounded to one decimal; they are observed historical frequencies, not probabilities of the next deck. Source-scoped archetype IDs take priority; missing IDs fall back to exact source labels. SAME_PERSON reviews do not combine identities. Candidate result/event duplicates are conservatively excluded from frequencies and remain inspectable without deleting or confirming anything.

Each archetype opens paginated supporting results using the same filters. Unknown archetypes, excluded candidates and all matching results have separate evidence views. Existing imported lists open through the existing API; returning preserves the filters, selected group and evidence page. Summary and evidence revisions detect intervening data changes and ask for a refresh instead of silently mixing counts.

New GET endpoints: `/players/:id/scouting` and `/players/:id/scouting/evidence`. Query parameters include `from`, `to`, `dateState`, `formatMode`/`format`, `divisionMode`/`division`, plus evidence `scope`, `group`, `limit` and `offset`. See [Milestone 6](docs/milestone-6.md) for precise denominators, filter semantics, examples and validation.

Start `pnpm api:start` and `pnpm web:dev` in separate terminals; open [PokéScout](http://127.0.0.1:5173). Restart an API process launched before this milestone. PostgreSQL stays on **55432**. No migration, new dependency, import or recurring job was required. Test commands remain `pnpm test`, `pnpm test:db`, `pnpm test:web`, `pnpm typecheck` and `pnpm web:build`; the existing `POKESCOUT_LIVE_API=1` opt-in also checks the new real-data flow.

## Milestone 5: compare identities and inspect provenance

In the search screen, select exactly two separate candidates, then choose **Comparar selecionados**. You can change the search to find a candidate in another source without losing the selection, remove a candidate, or return from comparison with the search/selection preserved. The comparison shows aliases, source IDs/scopes, source countries, historical events/archetypes, evidence bounds and recorded assessments. SAME_PERSON never combines histories. Contradictory assessments remain separate; the latest one is not automatically authoritative.

History duplicate warnings now link to both candidate source representations, with IDs, source URLs, retrieval times, detection signals and limitations. Coverage explanations distinguish what a source publishes from what was imported locally. Counts remain published source results, never confirmed unique participations.

The frontend uses the existing comparison endpoint with additive `view=summary` for an explicit projection without raw snapshots. The original response remains available when view is omitted. New read-only detail routes are `GET /duplicate-candidates/event/:id` and `GET /duplicate-candidates/result/:id`. They return one candidate pair, never perform detection/import or mutate records. Invalid parameters return 400 and missing evidence 404.

Start with `pnpm api:start` and `pnpm web:dev` in separate terminals, then open [PokéScout](http://127.0.0.1:5173). Restart an API process started before these changes. PostgreSQL remains on **55432**; there is no new migration, import, merge or web review-writing endpoint. Reviews are still recorded only by the existing CLI. See [Milestone 5](docs/milestone-5.md) for the contracts, proven versus synthetic cases, validation and file list.

## Milestone 4: mobile historical lookup

With the existing database running, start these commands in separate terminals:

```powershell
pnpm install
pnpm api:start
# In another terminal, from the repository root:
pnpm web:dev
```

Open [PokéScout locally](http://127.0.0.1:5173). Use browser responsive mode (390 × 844 or 320 px wide) for the mobile flow: search a name, inspect separate source identities, select a history and open an already imported historical list. Back navigation retains the search; returning from a list also retains history pagination. Existing real-data examples include Francisco Osorio (separate Labs candidates), Cerys Jones (international Labs history) and Jooho Koh (partial Main results and an imported list). Search is normalized substring matching, not transliteration or fuzzy typo correction.

`apps/web/.env.example` documents optional configuration. Defaults work without copying it: `VITE_API_BASE_URL=/api` and the server-side `API_PROXY_TARGET=http://127.0.0.1:3001`. The Vite development/preview proxy sends `/api` to the local API; no broad CORS setting is added. Set the proxy target to match any custom API_PORT. Keep DATABASE_URL and other secrets out of VITE_* variables. PostgreSQL stays on **55432**. The web server binds to loopback by default; the tested mobile flow is browser emulation, not a claimed physical-phone/LAN deployment.

```powershell
pnpm typecheck
pnpm web:build
pnpm web:preview
# Preview the production bundle at http://127.0.0.1:4173 with API running.
pnpm --filter @tcg-scout/web exec playwright install chromium
pnpm test:web
# Optional: use installed Edge instead of downloading Chromium:
$env:PLAYWRIGHT_CHANNEL='msedge'
pnpm test:web
# Opt-in real API/PostgreSQL read-only browser smoke:
$env:POKESCOUT_LIVE_API='1'
pnpm test:web
Remove-Item Env:POKESCOUT_LIVE_API
```

Normal browser tests use synthetic API fixtures and do not need a database or external websites. The opt-in smoke requires the preserved Milestone 3.5 imports and a running local API. `pnpm test` and `pnpm test:db` retain their existing suites. A deployed build needs its own same-origin `/api` reverse proxy; Vite's dev/preview proxy is for local use. See [Milestone 4](docs/milestone-4.md) for UI decisions, validation and limitations.

## Start the database

```powershell
pnpm install
Copy-Item .env.example .env
# Edit .env: replace the example password in POSTGRES_PASSWORD and DATABASE_URL.
pnpm db:up
pnpm db:migrate
```

Do not overwrite an existing `.env`. The local development port is **55432**, bound to `127.0.0.1`; change POSTGRES_PORT and DATABASE_URL together if occupied. PostgreSQL data persists in the Compose project volume. Credentials are read from environment variables / ignored `.env`, never committed. Docker Compose reads `.env` itself; Prisma and application scripts load the root `.env` without overriding existing environment variables.

`db:up` negotiates the engine API version before starting Compose, addressing mismatches between a newer Compose plugin and Docker engine. `db:migrate` generates Prisma Client and deploys committed migrations. `pnpm db:generate` generates the client without contacting PostgreSQL. For a new development schema change, use Prisma migrate dev in `packages/database` and review generated SQL, including custom constraints. Never reset a database to apply migrations.

To stop PostgreSQL while retaining data: `docker compose stop postgres`.

## Import one tournament

```powershell
pnpm scout:sync --tournament 0075 --max-decklists 1 --deck-size 60
pnpm scout:sync --tournament 0012 --max-decklists 1 --deck-size 60
pnpm scout:sync --tournament 0075 --division SR --max-decklists 0
```

Tournament IDs are Labs URL IDs, including leading zeros; divisions are MA (default), SR or JR. Only explicitly requested tournaments are retrieved. These commands import complete embedded standings arrays, not just the first rendered HTML rows. Source completion and import completeness are different fields.

Full list retrieval defaults to **5 per run**, with a hard maximum of 20; `--max-decklists 0` imports only standings/archetypes and availability. Already imported lists are reused. Each subsequent run can import the next pending lists without duplicating players, entries, decks or existing cards. No recurring job or catalog crawler is installed. The adapter spaces requests at least 1.1 seconds apart, serializes requests per client, caches pages in memory for one hour and stops on HTTP errors without retries.

The source samples do not provide a format field; it stays null unless present in future source metadata or explicitly supplied using `--format`. STANDARD, EXPANDED and UNLIMITED require exactly 60 cards. `--deck-size 60` explicitly validates the total without inventing a tournament format. Other/unknown formats have no inferred size; card quantities and identifiers are still validated. This is ingestion validation, not a full deck-legality checker.

Sync output reports SyncRun ID, status, entry counts, imported/pending lists and issues. CLI exit codes are 0 (SUCCESS), 2 (PARTIAL), 1 (FAILED/invalid arguments/database errors); pnpm may wrap nonzero script exits as its own failure code. A capped run with pending lists is intentionally PARTIAL and leaves `fullySynchronized=false`, even when every standing was imported correctly. A source-completed event is represented separately by `sourceCompleted=true`.

## Search and history

```powershell
pnpm scout:search --name "Francisco Osorio"
pnpm scout:history --player <UUID-returned-by-search>
```

Search preserves aliases and normalizes case, accents, whitespace and minor punctuation. Results are separate internal player UUIDs with source IDs, countries and possible-match IDs. Never choose an identity solely by a matching name. In the real validation data, Francisco Osorio / CL appears under different Labs IDs; both are returned separately. A previously verified stable source ID can collect multiple historical appearances, including name variants.

History includes event-specific names/countries/results, archetypes, decklist status and any imported cards. These are public historical decks, not knowledge of a player's current deck. Source URLs and retrieval times remain attached.

Reusable services in `packages/application` also offer `listTournaments()` and `knownDecklist(entryId)`. The local read-only API below exposes these query services.

## Errors and recovery

Each entry is committed in a bounded transaction. Player identity, alias, entry and deck metadata commit together. A malformed entry is reported while other valid entries remain saved. Deck replacement validates first, then replaces cards atomically; an error cannot erase an older valid list. Missing country, placement or archetype fields do not clear previously valid values; explicit disqualification may clear placement. Unseen old entries are retained and flagged for review, never silently deleted. A changed source identity on the same entry is rejected for manual reconciliation.

Run outcomes are RUNNING, SUCCESS, PARTIAL and FAILED. Lists distinguish UNAVAILABLE, AVAILABLE (pending), IMPORTED and FAILED, with availability, last attempt, last error and successful import time stored separately. Previous valid cards remain accessible after failed refreshes. The standings importer still skips successfully imported lists. Use the explicit bounded reconciliation command below for deliberate list checks and refreshes.

One RUNNING run per event/division is enforced by PostgreSQL. Identity creation uses transaction-scoped advisory locks to avoid duplicate players across concurrent event imports. If the process dies or PostgreSQL disappears before the outcome can be written, its RUNNING record remains visible. Confirm that process is no longer active, then mark **that specific run** FAILED with a finishedAt timestamp using your database administration tool before retrying. There is deliberately no timer that could unlock a still-running import. A run normally records retrieval failures against the existing tournament and clears `fullySynchronized` while preserving valid records.

Unreachable PostgreSQL produces a setup error; missing schema asks for migrations. Unknown player/entry IDs and malformed tournament IDs produce explicit errors. HTTP restrictions are never bypassed.

## Milestone 3: conservative identity review

```powershell
pnpm scout:identity --name "Francisco Osorio"
pnpm scout:identity --a <player-UUID> --b <other-player-UUID>
pnpm scout:identity --a <player-UUID> --b <other-player-UUID> --decision UNCERTAIN --reviewer "Local reviewer" --reason "Public evidence does not establish a shared identity." --evidence "https://public-source.example/evidence"
```

Replace the example evidence URL with actual public evidence. Decisions are SAME_PERSON, DIFFERENT_PEOPLE or UNCERTAIN. Recording requires a reviewer, reason (10–2000 characters) and one or more public HTTP(S) evidence URLs; repeat --evidence for multiple URLs. Reviews preserve an evidence snapshot and are appended. Even SAME_PERSON never merges players or changes source identity ownership. Comparisons return at most 100 appearances per player and 50 recent reviews; historyTruncated flags limited evidence. Country/overlap summaries apply to those returned appearances only. Reviewer labels are local attribution, not authentication.

## Milestone 3: bounded decklist reconciliation

Use an **internal tournament UUID** returned by the tournaments endpoint, rather than a Labs URL ID.

```powershell
pnpm scout:reconcile --tournament <tournament-UUID> --mode pending --max-decklists 1
# The preceding command only previews the database selection; it makes no external request.
pnpm scout:reconcile --tournament <tournament-UUID> --mode pending --max-decklists 1 --apply
pnpm scout:reconcile --tournament <tournament-UUID> --mode refresh --max-decklists 1 --apply
```

pending imports available lists with no previous successful import. refresh deliberately rechecks previously imported, currently source-available lists, including failed refreshes. Default cap is five, hard maximum 20. A source or validation failure stops the batch; valid previous cards survive. Unchanged contents preserve card IDs and the successful import time. Changed contents are replaced atomically with before/after audit records in DecklistReview. The command shares the existing RUNNING event lock with standings sync, and cannot certify standings completeness. Exit codes remain 0/SUCCESS, 2/PARTIAL and 1/FAILED. Apply the additive migration using pnpm db:migrate; never reset existing imports.

## Milestone 3: local read-only API

```powershell
pnpm api:start
Invoke-RestMethod "http://127.0.0.1:3001/players?name=Francisco%20Osorio"
Invoke-RestMethod "http://127.0.0.1:3001/tournaments"
```

The API binds to 127.0.0.1; API_PORT defaults to 3001. PostgreSQL stays on 55432. Available GET routes: /health, /players?name=..., /players/:id/history, /tournaments, /entries/:id/decklist and /identity-reviews/compare?playerAId=...&playerBId=.... History uses limit (default 50, maximum 100) and offset, returning total/truncated; other list routes accept limit up to 100. The history CLI returns at most 100 appearances with total/truncated. Invalid input is 400, missing records/lists are 404 and unexpected failures are a sanitized 500. There are no write endpoints or source requests from routes. This API exposes historical evidence, not a current-deck claim. See [Milestone 3](docs/milestone-3.md) for the complete contract and validation.

## Verification

A busca e o catálogo priorizam Labs, mantendo as correspondências Main nos detalhes e os registros exclusivos visíveis. As opções **Mostrar identidades separadas por fonte** e **Mostrar torneios separados por fonte** restauram a visão original. Veja [Labs prioritário e Main complementar](docs/preferred-sources.md).

O histórico reúne por padrão nomes iguais de Labs e Limitless em uma visão de consulta, com possíveis duplicações expansíveis e fontes preservadas. Desmarque **Reunir nomes iguais no Labs e Limitless** para consultar somente a identidade selecionada. Veja [regras e limites do histórico conjunto](docs/combined-history.md).

Históricos importados antes de `eventDate`: `pnpm scout:repair-dates` apresenta datas recuperáveis dos rótulos já salvos; `pnpm scout:repair-dates --apply` preenche somente datas nulas. Veja [correção de históricos e Recife](docs/history-date-repair.md).

Para a publicação do frontend, API e banco, consulte [Hospedagem](docs/hosting.md). O ambiente atual continua local; a preparação de produção exige um banco separado e validação de deploy.

```powershell
pnpm test
pnpm test:db
pnpm typecheck
pnpm scout:proof
```

Ordinary tests use local sanitized HTML and do not require any website or database. Database tests require PostgreSQL and generated Prisma Client, create a randomly named isolated schema, apply the real migrations, test constraints/sync/query behavior, then drop only that schema. They never clear the application schema. Set TEST_DATABASE_URL to a separate development/test PostgreSQL database if desired; DATABASE_URL is otherwise used with an isolated schema. Never point tests at production.

`pnpm scout:proof` preserves Milestone 1's offline five-entry/one-list proof. Optional live proof remains available with `--live https://labs.limitlesstcg.com/0009/standings`.

See [architecture](docs/architecture.md), [source investigation](docs/data-sources.md), [domain model](docs/domain-model.md) and [Milestone 2 validation](docs/milestone-2.md) for verified counts and limitations.


## Milestone 3.5: bounded international expansion

Apply the additive international migration with `pnpm db:migrate`; PostgreSQL remains on **55432**. Existing Latin American imports are retained.

`config/international-sample.json` explicitly selects six new source events: EUIC London (GB), Regional Melbourne (AU), NAIC New Orleans (US), Worlds San Francisco (US), Champions League Yokohama (JP), and Korean League Final Season (KR). The last two use the separate **limitless-main** adapter, never Labs/Play identifiers.

`pnpm scout:expand` previews this selection using database reads only. `pnpm scout:expand --apply` retrieves/imports the explicit selection. Override the selection with `--manifest path/to/selection.json`. A manifest permits at most six unique events and zero or one list per event. The budget is cumulative against already imported lists and rechecked under the RUNNING event lock, so repeating this command does not fetch another list for an event that already has one. A failed source or entry/list validation stops the batch; expected partial coverage/list-cap statuses do not cause an unrelated next event to be skipped. No automatic catalog or player-history crawling is installed.

Both clients use public HTML only, serialize requests, cache successful pages in memory for one hour and make no retries. Minimum spacing is 1.1 seconds for Labs and 1.3 seconds for Main. Main reads one catalog page to recover an explicitly selected event's format if that row is present, without following event links or paginating. An absent catalog row leaves format unknown.

`pnpm scout:main-history --player 7427` inspects one public Main profile. Add `--results-page` to read that explicit public results page instead. It returns source-referenced published finishes/archetypes/list URLs, preserves source ordering, and makes no career-completeness claim. It never imports the other events found on a profile automatically.

Main's sampled pages publish **32 selected results per event**, not full standings. `resultsCoverage=PUBLISHED_RESULTS` makes this explicit. Unknown division, season, match points, W/L/T, disqualification and completion state stay **null**. Estimated participant counts carry `reportedPlayerCountApproximate`. Country on a result is the player's reported country; country on the tournament is the host country. `eventDate` is an optional calendar start day, not an invented UTC instant. Original date labels and source timestamps remain available.

Main uses source format `standard-jp`, distinct from Western `standard` or an unknown Labs format. The Korean event's source note mentions additional promos, so no format equivalence is inferred. Deck rows preserve source set/number/language; a rendered English list does not establish the physical printing or language used at the tournament.

Potential event/result duplicates are retained as **candidates** with both source references. No source row or player is merged. History retains `total` as the count of published source result rows and now exposes `totalMeaning=published-source-results`, `confirmedParticipationCount=null`, result duplicate candidates and tournament duplicate candidates. Tournament listings mark their entry-count meaning as published source results. Identity comparisons also expose candidate event overlaps. Never sum candidate-linked source rows as confirmed extra appearances.

The existing GET history/tournament/decklist routes serve the new records through the same query services. Existing Labs synchronization and reconciliation commands remain available; Main list refresh through the Milestone 3 reconciliation tool is deliberately unsupported until its event/list binding workflow is extended. Initial Main list import is supported by the explicit expansion command.

See [Milestone 3.5 validation](docs/milestone-3.5.md) for proven coverage, actual import counts, tests and regional gaps. The sample does not establish worldwide tournament or player-history completeness.
