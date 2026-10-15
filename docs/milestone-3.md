# Milestone 3 — identity review, decklist reconciliation and read-only API

Implemented and validated on 2026-10-14. PostgreSQL remains on loopback port **55432**. No frontend, authentication, scheduler or prediction engine was introduced.

## Plan and implementation choices

1. Preserve existing identity ownership. Offer candidate search and explicit pair comparison using aliases, source identities, countries, overlapping tournament appearances and source URLs. Record a human assessment with reviewer, reason, public evidence URLs and a snapshot of the compared evidence. Never merge by name or change imports as a side effect of review.
2. Reconcile lists only for an explicitly selected imported tournament. Make the CLI a database-only dry run by default, with `--apply` selecting a bounded job. Separate missing lists (`pending`) from deliberately rechecking imported lists (`refresh`). Keep the source adapter as the only path to external websites.
3. Add local Fastify GET endpoints that delegate to application services, validate inputs with Zod, bound result sizes, return explicit 404s and hide unexpected database errors.
4. Apply an additive migration, retain the original 38 tests and validate all new behavior against offline fixtures and an isolated real PostgreSQL schema. Check the application data separately.

## Identity review

`scout:identity --name` returns existing separate candidates; `--a/--b` compares a pair. Identical normalized names and shared countries are evidence for inspection, never proof of identity. Same-event appearances are explicitly highlighted. Comparison returns at most 100 appearances per player and the most recent 50 reviews; total appearance counts and `historyTruncated` make the evidence boundary visible. Country and overlap summaries cover the returned appearances only.

Providing a decision writes an additional `IdentityReview` row. Decisions are `SAME_PERSON`, `DIFFERENT_PEOPLE` and `UNCERTAIN`; all require a reviewer, a substantive reason and at least one HTTP(S) evidence URL. The service validates but does not visit those URLs. Reverse-order comparisons use the same canonical pair. Later assessments are appended; previous assessments remain available. Even `SAME_PERSON` changes no player, source identity, alias or entry ownership. Automatic merges, canonical redirects and undoing actual merges remain outside this milestone. The local reviewer label is not an authenticated identity; append-only behavior is enforced by the application interface, not a database immutability trigger.

## Bounded decklist reconciliation

`scout:reconcile` accepts an **internal tournament UUID**, defaults to five lists and rejects limits outside 1–20. `pending` selects available lists with no successful import; `refresh` selects available lists with an existing successful import, including failed refreshes retaining earlier cards. Source-unavailable lists are excluded. Oldest/no previous attempt is selected first, with a deterministic ID tie-breaker. Dry runs neither retrieve external pages nor create jobs.

Applying a plan claims the existing PostgreSQL partial unique index for one RUNNING job per event/division. Both standings synchronization and reconciliation use this exclusion. Selection is re-read after acquiring the job slot. No standings are retrieved by reconciliation; only selected public decklist URLs go through `LimitlessLabsSource`, retaining its serialized requests, 1.1-second spacing, cache and no-retry behavior. A failure stops the batch after recording it.

Incoming lists must match the stored source, source URL and deck external ID, carry a valid retrieval timestamp, and satisfy existing card/expected-size validation. Comparison aggregates identical source printing rows and ignores order; it does not normalize cards across printings. `UNCHANGED` retains card IDs and the original import timestamp, while updating last-attempt status. `IMPORTED` and `CHANGED` replace cards and save an audit row in the same transaction. Audit includes before/after cards, prior import time, retrieval time, source URL and SyncRun ID. `FAILED` records an error and retains the previous valid list, which remains readable through queries and the API.

Jobs report SUCCESS, PARTIAL or FAILED through SyncRun and CLI exit codes 0, 2 or 1. Refresh caps and pending/failed lists produce PARTIAL. List-only success does not certify that standings are complete: it never promotes `fullySynchronized=false` to true. Full synchronization remains responsible for that claim. As before, an interrupted RUNNING job requires explicit recovery after checking that its process has stopped.

## Local read-only HTTP API

Start using `pnpm api:start`; the server binds only to `127.0.0.1:3001` by default. Set `API_PORT` to change the API port. PostgreSQL remains independent on 55432. Closing the server disconnects Prisma. GET/automatic HEAD routes are provided; no write, synchronization or review-recording endpoints exist.

| Route | Parameters / behavior |
| --- | --- |
| `GET /health` | Process liveness; startup checks database connectivity. |
| `GET /players` | `name` required; normalized minimum two characters; `limit` 1–100, default 30. Separate candidates and truncation flag. |
| `GET /players/:id/history` | Player UUID; `limit` 1–100, default 50; `offset` 0–100000, default 0. Includes total, pagination and truncation. |
| `GET /tournaments` | `limit` 1–100, default 50; counts and latest synchronization job. |
| `GET /entries/:id/decklist` | Entry UUID; previously successful cards remain accessible after a failed refresh. |
| `GET /identity-reviews/compare` | Distinct `playerAId` and `playerBId` UUIDs; bounded evidence and review history. |

Invalid inputs return 400, missing records/lists return 404 and unexpected errors return a generic 500. No HTTP route accesses an external site. Routes use the existing read models, including public source provenance/raw snapshots; this is a local inspection API, not a versioned public deployment contract. Identity assessment and reconciliation writes remain local CLI operations.

Implementation follows the [official Fastify server reference](https://fastify.dev/docs/latest/Reference/Server/) for application construction, error handling and request injection tests.

## Validation results

- **28 offline tests passed:** all original 21 plus seven comparison/API tests.
- **25 PostgreSQL tests passed:** all original 17 plus eight identity, reconciliation and database-backed API tests. Both committed migrations were deployed into a random isolated schema; cleanup drops only that schema.
- **53 tests total**, including all **38 Milestone 2 tests**.
- TypeScript passed. The original offline proof passed: five fixture entries, one historical 60-card list.
- Migration `202610140002_reviews` applied successfully to the existing application database. Its SQL only adds review tables, constraints and indexes; no original table is cleared or rewritten.
- Live local HTTP smoke checks returned health OK, all four tournaments and two separate Francisco Osorio candidates. A one-entry history page reported two total appearances and `truncated=true`.
- The identity search CLI returned separate source IDs 5391 and 57170. A refresh dry run selected one already imported Recife list without fetching a page or creating a job.
- SHA-256 comparisons of complete, ID-ordered rows across eight existing application tables matched before and after the validation/smoke operations. These fingerprints were collected after the additive migration; they prove tests and read-only smoke checks did not alter application records, not a pre-migration snapshot.

Application data remains: **4 tournaments/divisions, 2,944 players, 2,944 source identities, 2,949 aliases, 3,195 entries/decks, three imported lists and 80 distinct card rows** (180 cards by quantity). Existing five SyncRuns are retained. Available lists still pending: **3,182**. Validation performed no live source refresh and recorded no speculative identity decisions in the application database.

## Files and remaining limits

Added `apps/api` (factory, loopback launcher and injection tests), application identity/reconciliation/error modules, CLI commands, comparison tests, additive Prisma models/migration and this report. Extended the existing PostgreSQL test harness without removing cases. Updated workspace configuration, package scripts/lockfile, query history pagination, README and architecture notes.

Undocumented Labs endpoint stability, production request-rate agreements, missing source formats/timezones, cross-print card normalization and real upstream correction frequency remain unresolved. Correction handling was validated with controlled fixture mutations; no claim of newly observed live source corrections is made. Candidate discovery is bounded normalized search, and review annotations do not resolve source identity changes rejected by the importer. No large crawl or recurring ingestion was enabled.
