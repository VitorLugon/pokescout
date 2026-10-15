# Milestone 2 validation results

Validated 2026-10-14 against the local PostgreSQL Compose service. No frontend, public HTTP API, authentication or prediction feature was created.

## Environment and migrations

PostgreSQL successfully started in Docker and passed its healthcheck. Windows blocked port 5433, so the development configuration uses the verified available loopback port **55432**. Docker Compose required negotiating the engine-supported API version; `scripts/db-up.mjs` handles that automatically. The launcher was tested against the running service. Generated development credentials live only in ignored `.env`; the example uses placeholders.

`pnpm db:migrate` applied `202610140001_initial` successfully. Prisma Client was generated successfully. Database tests independently applied this same migration, including CHECK constraints and the partial RUNNING-run index, to isolated schemas.

## Historical imports

| Labs ID / division | Event | Provenance | Entries saved | Available list flags | Lists imported | Sync status |
| --- | --- | --- | --- | --- | --- | --- |
| 0075 / MA | Recife Regional, October 3–4, 2026 | RK9 RE001-a2hqIrDZOyenzQ | 1074 | 1072 | 1 | PARTIAL: list cap |
| 0012 / MA | Bogotá Special Event, December 7–8, 2024 | PlayLATAM BOG25-TCG-MA | 215 | 212 | 1 | PARTIAL: list cap |
| 0009 / MA | São Paulo International, November 15–17, 2024 | RK9 LA01mwu6ugCwMEJxWT2H | 1810 | 1805 | 1 | PARTIAL: list cap |
| 0075 / SR | Recife Regional Seniors | Same RK9 event, separate division | 96 | 96 | 0 | PARTIAL: list cap |

Recife MA and Bogotá MA were imported with the live CLI, each capped at one public decklist. São Paulo and Recife SR were imported using the same adapter/service from already retrieved public HTML captures, avoiding redundant HTTP requests. All received standings in these imports were saved; no parser/entry/list extraction failure occurred. Source formats remain null; the three imported lists were explicitly validated at 60 cards each. Only source-local printed set/number representations are claimed.

**Application database totals** (test schemas excluded):

| Entity | Count |
| --- | --- |
| Tournament/division rows | 4 |
| Players | 2944 |
| Source identities | 2944 |
| Player aliases | 2949 |
| Tournament entries | 3195 |
| Deck metadata rows | 3195 |
| Successfully imported full lists | 3 |
| DeckCard rows | 80 |

The three lists represent **180 cards by quantity**, stored as 80 distinct source rows. There are 3182 currently available lists not imported. These intentionally remain pending, and fullySynchronized remains false. Tests separately prove SUCCESS when a complete small snapshot and all its available lists have been imported. There is no claim that thousands of full lists were synchronized.

Bogotá's same captured 215-entry snapshot was re-imported with list retrieval disabled. Before and after: 4 tournaments, 2944 players/identities, 2949 aliases, 3195 entries/decks and 80 card rows. Only a new SyncRun was added; no data duplicates were created. The database test also repeats a full successful import with identical options and checks stable card IDs and list timestamp.

## Identity, search and history

The live search command `pnpm scout:search --name "Francisco Osorio"` returned distinct players for Labs global IDs 5391 and 57170, both displaying CL. They are exposed as possible matches and are not merged. The source does not establish whether this is a split identity or different people.

For global ID 5391, the database query service and `scout:history --player <internal UUID>` returned two appearances: São Paulo and Bogotá. The same global source ID reused one player, while event-scoped tp_id remained 1016 and 86. Source URLs, original result names, countries, records and historical archetypes were retained.

## Automated checks

- `pnpm test`: **21 passed**, including all 11 Milestone 1 tests. External websites and PostgreSQL are not needed.
- `pnpm test:db`: **17 passed** against real PostgreSQL, with real migration application in isolated schemas.
- `pnpm typecheck`: passed.
- `pnpm scout:proof`: existing offline proof preserved and passed.

Database cases cover idempotency, repeated appearances/aliases, ambiguous names, missing fields/lists, failed list imports and retry, partial standings, capped imports, invalid entries, retrieval failures, unique and foreign-key constraints, positive quantities, atomic rollback, overlapping-run prevention, query services, wrong-size constructed decks, changed source identities, omitted old entries, and conservative event-scoped fallback identities when global evidence is insufficient.

## Limitations and next milestone

The public source contract is undocumented; no production rate agreement, webhook or automated scheduler was established. The importer preserves and validates embedded JSON rather than changing transports while introducing persistence. Format and timezone remain unknown where the source omits them. Country can be null. Source identities can split, and source lists may normalize physical printings. Historical Labs standings are computed by Labs, not guaranteed official final standings.

Imported lists are reused; automatic refresh/reconciliation of their contents is deferred. Interrupted RUNNING jobs require explicit manual recovery after confirming the old process is stopped. Search performs normalized substring matching and exposes same-key candidates; it is not a typo-tolerant ranking engine or an identity review UI. Large-scale crawling and live-event behavior remain unvalidated.

Recommended next milestone: add a reviewed workflow for identity splits and deliberate list refresh/reconciliation, validate source correction behavior with another bounded sample, then expose the existing services through thin Fastify endpoints. Keep predictions deferred until historical data quality is established.

## Files created or modified

Created:

- `compose.yaml`, `.env.example`, and the database launcher `scripts/db-up.mjs`.
- `packages/database/package.json`, `prisma.config.ts`, `prisma/schema.prisma`, committed initial migration/lock file, client factory, and PostgreSQL synchronization tests.
- `packages/application/package.json`, synchronization, persistence, validation and query service modules, public exports, and offline validation tests.
- `scripts/cli-common.ts`, `scout-sync.ts`, `scout-search.ts`, and `scout-history.ts`.
- Additional Labs fixtures/manifest for Recife Masters, Recife Seniors and Bogotá Masters, plus parser tests.
- `docs/architecture.md` and this validation report.

Modified:

- Root `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `.gitignore`, and README.
- Shared domain contracts/search-key helper; Labs types, mapper and public exports (existing parser/client remain intact).
- `docs/data-sources.md` and `docs/domain-model.md`.

Local ignored state: generated Prisma Client, development `.env`, public research captures and diagnostic proof output. AGENTS.md and the original Milestone 1 tests/fixtures were preserved.
