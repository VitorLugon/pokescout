# Persistence domain model

The Prisma schema in `packages/database/prisma/schema.prisma` implements the Milestone 2 model; source-neutral ingestion contracts remain in `packages/shared`. No frontend, authentication or prediction entities are included.

| Entity | Identity and purpose |
| --- | --- |
| Player | Internal UUID and display name. A source-local identity is sufficient for creation; matching names do not merge players. |
| PlayerAlias | Original name, normalized name and punctuation-tolerant search key, source URL and sync time. Unique per player/original name; search indexes on normalizedName and searchKey. |
| SourceIdentity | Source namespace, verified identity scope, external identifier, player FK, source URL and sync timestamp. Unique source/scope/externalId. Labs player_id is global within Labs; no cross-provider identity equivalence is implied. |
| Tournament | Source event ID and division, unique source/externalId/division. Name, verbatim date label, nullable startsAt/format/expected deck size/country, season, reported count, upstream IDs, source URL, sync timestamp and raw metadata. sourceCompleted is independent of fullySynchronized. |
| TournamentEntry | Tournament/player FKs, tournament-scoped tp_id, original player name and country observed for that result, placement, points and W/L/T, disqualification, source URL, sync time and raw source row. Unique tournament/externalId. |
| Deck | One per entry, entry-scoped source key, source URL/time, nullable archetype slug/name, public list URL, source availability, list status, successful import time, last attempt/error and raw imported list with source references. A metadata-only deck row can represent an unavailable list without an archetype. |
| DeckCard | Deck FK, source row position, category, positive quantity, name, set and string collector number. Unique deck/position. No deduplication by name or guessed printing identity. |
| SyncRun | Requested source/event/division/URL, optional tournament FK, lifecycle status, start/finish time, received/saved counts, imported/pending list counts and structured issues. Failed retrieval attempts remain traceable even before a tournament can be created. |

Foreign keys prevent orphan identities, results and lists. SQL CHECK constraints require nonnegative records/counts, positive placements/quantities and known card categories. A partial unique index prevents overlapping RUNNING syncs for the same event/division. Source-identity creation is serialized with short PostgreSQL transaction-scoped advisory locks.

Tournament route IDs remain zero-padded strings. Entry tp_id is stored as a source-scoped string; only URL formatting pads to four digits. The ingestion contract's derived entry key (event:division:entry) is an adapter identifier, not a new provider ID. Tournament divisions are separate persisted rows sharing the original event ID.

Missing country/placement/archetype fields do not erase previously valid values. Explicit disqualification can clear placement. Missing old entries remain stored and cause a partial/review outcome. Deck availability and successful list import are independent: an old imported list can remain accessible after the source no longer advertises it. Cards are replaced atomically only after validation.

Dates without timezone remain text. startsAt accepts only a verified explicit ISO instant; sampled event metadata provides no such instant, so it stays null. A bare source updated_at remains in raw metadata. The sampled format is unknown; it stays null unless explicitly supplied by an operator. STANDARD/EXPANDED/UNLIMITED imply a 60-card size; an explicit deck-size override can validate a known size without fabricating the format.

Deferred: reviewed cross-source identity links, upstream merges/splits, canonical card catalog IDs/physical printing reconciliation, fully dated tournament calendars, match persistence, automatic imported-list refresh and official-versus-computed result revisions. These require more source evidence, not invented fields.

Explicit null/zero global Labs player IDs fall back to a tournament/division-scoped identity, so unknown identities cannot collapse into one player. An entirely absent player_id field is still treated as a malformed source payload, preserving Milestone 1 validation behavior. Fallback behavior is covered by synthetic offline/database tests; all inspected real sample IDs were positive.

Milestone 3.5 widens previously required division, season, completion and match-record fields to allow null where the Main source does not publish them. No existing values are cleared. Tournament adds resultsCoverage, reportedPlayerCountApproximate and a calendar eventDate; DeckCard adds nullable language. Unknown divisions remain genuinely null and participate in PostgreSQL NULLS NOT DISTINCT uniqueness/job exclusion. TournamentDuplicateCandidate/ResultDuplicateCandidate are advisory provenance links, not canonical identity/event merges. Main source IDs occupy a separate namespace. See milestone-3.5.md for coverage semantics and validation.
