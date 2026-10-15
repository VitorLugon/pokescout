# Public tournament data sources

Investigated 2026-10-14. **Verified** means observed in public documentation or ordinary unauthenticated HTTP responses during this investigation. **Proposed** means an implementation recommendation. **Unknown** means not established. No authentication, CAPTCHA, or access-control bypass was attempted. No user/account endpoint was requested directly.

## Catalog expansion after Milestone 6

The later explicit request authorizes expansion beyond the six-event sample.
Public catalog captures now enumerate **76 Labs Masters events** across source
seasons 2027/2026/2025 and **540 Main events** across 22 HTML pages. Main pagination
is ordinary `?page=N` navigation, verified in public markup and its public
navigation script. Divisions are discovered only from explicit same-event
SR/JR standings links in captured Masters HTML, without guessing IDs.

See [catalog expansion](catalog-expansion.md) for controlled commands and
[actual database coverage](catalog-coverage.json) for imported counts and gaps.
Enumeration is not a completeness claim. The earlier milestone sections below
describe their historical sample scopes; their six-event limits do not describe
this later explicitly requested bulk pass. Public request protections remain.

The bulk importer records source IDs/URLs/timestamps, uses persistent successful
HTML snapshots, serial spaced HTTP, bounded database concurrency and per-event
resume markers. It does not refresh completed snapshots automatically or fetch
new decklists in bulk. Main records remain selected public results with unknown
fields preserved. Duplicate candidates preserve both sources and do not establish
additional participation or same-person identity.

Pokémon sprites are static presentation assets, independently obtained from the
public Pokémon Showdown sheet with multilingual species aliases from PokeAPI.
They do not unify external archetype IDs or infer current decks. Credits and
retrieval details are in [the asset notes](../apps/web/public/sprites/README.md).

**Verified division gap:** Labs advertises Lima 2026 Seniors, but its ordinary
public HTML embeds `players:null` and a successful empty standings array.
Such pages are represented with UNKNOWN coverage and no invented participant
count/results. An advertised link alone is not evidence of available standings.

**Verified cross-source overlap:** Labs 0076 (Louisville, October 9–11) exposes
2,927 Masters results; Main 581 (October 10) publishes 547 results and explicitly
links to that Labs standings URL. This public link generates an advisory duplicate
candidate despite different calendar start dates. Both source dates/IDs survive;
neither the event pair nor matching result names automatically merge players.

**Verified source-identity conflict:** Main 520 publishes placements 101 and 259
with the same profile ID 8549 and different archetypes. Both complete parsed rows
are retained in tournament source metadata for review, excluded from player
histories. This does not establish whether the profile is mislinked, the rows are
duplicates or they describe different people. Catalog responses expose the held
row count, and sync reports retain the quality warning. No synthetic identities
or extra confirmed appearances are created.

**Verified non-country marker:** Main Players Cup IV (295) uses `ptcgo` in its
header's location icon. The adapter preserves that label in source metadata and
sets host country to null, rather than treating a platform marker as a nation.
Player country labels remain independent. Catalog projections expose the source
location label separately; no cross-platform format equivalence is inferred.

## Scope and evidence

The repository initially contained only `Agents.md`, which was read in full before changes. The implemented proof covers one event: [2024 São Paulo International, Masters](https://labs.limitlesstcg.com/0009/standings). Additional pages were inspected only to establish provenance and identity behavior, not imported by the adapter.

| Public page | Verified observation |
| --- | --- |
| [Labs index](https://labs.limitlesstcg.com/) | Lists major in-person tournaments; states coverage depends on available RK9/PlayLATAM information and warns its independently calculated standings may contain errors. |
| [São Paulo standings](https://labs.limitlesstcg.com/0009/standings) | Node fetch returned HTTP 200 HTML; embedded array has 1810 entries, 1805 with archetype and decklist flags. HTML initially renders a top-512 view; embedded data is broader. |
| [Player result](https://labs.limitlesstcg.com/0009/player/0509) | Tournament entry 509 links to global Labs profile 1837; individual matches and result payloads embedded. |
| [Public historical list](https://labs.limitlesstcg.com/0009/player/0509/decklist) | JSON groups pokemon/trainer/energy; 26 distinct rows totaling 60 cards. |
| [Global profile](https://labs.limitlesstcg.com/players/1837?season=2025) | Lists 12 finishes in the season, with tournament IDs, entry IDs, records and deck links. |
| [Bogotá Masters](https://labs.limitlesstcg.com/0012/standings) | 215 embedded entries; metadata names upstream PlayLATAM event BOG25-TCG-MA. |
| [RK9 public roster](https://rk9.gg/roster/LA01mwu6ugCwMEJxWT2H) | HTTP 200 without login; HTML names, countries, divisions, partially masked player numbers and public decklist links. Masked numbers are deliberately excluded from our fixtures/model. |
| [PlayLATAM public roster](https://pairings.playlatam.net/roster/BOG25-TCG-MA) | HTTP 200 without login; rendered participant information and public decklist links. |

A PowerShell HTTP client failed during TLS authentication; Node's standard fetch succeeded with normal certificate verification. This is an environment/client difference, not evidence of a site access restriction. No TLS verification was disabled.

## Limitless official tournament API

**Verified from [developer documentation](https://docs.limitlesstcg.com/developer) and [tournament endpoints](https://docs.limitlesstcg.com/developer/tournaments):** base URL is `https://play.limitlesstcg.com/api`. It documents tournament discovery, details, standings and pairings; standings include player IDs, country, placement, record, archetype and optional lists. Player usernames persist between tournaments, while display names can change. Tournament IDs are opaque strings. Most endpoints need no API key; deck categorization rules require one. Response headers communicate rate limits.

**Reliability/limitations:** documented contract is preferable to HTML, but coverage is the Play tournament platform. No evidence establishes that its IDs, player accounts or dataset are shared with Labs. **Unknown:** whether any specific Labs event also exists in Play.

**Proposed update strategy:** separate LimitlessApiSource, bounded pagination, caching, response-header rate limiting and documented completed-event webhooks where applicable. **Recommended usage:** Play-hosted events only; never silently substitute its API for Labs ingestion.

## Limitless Labs

### Identifiers and representation (verified)

- Tournament route IDs are zero-padded strings, e.g. `0009`; preserve them exactly. Global profile finish data uses numeric `tournament_id: 9` for that event. Do not apply numeric conversions outside this observed mapping.
- Masters URL is `/{id}/standings`; HTML links Seniors `/{id}/SR/standings` and Juniors `/{id}/JR/standings`. Division code in embedded Masters requests is `MA`. Milestone 1 parsed/tested Masters; Milestone 2 additionally validates Recife Seniors (see below).
- Standings rows contain `player_id`, `tp_id`, original `name`, `country`, `placement`, `points`, `wins`, `losses`, `ties`, `opw`, `opw2`, drop/day2/topcut/disqualification flags, `decklist`, `deck_id`, `deck_name`, and icon names. Null placement and missing archetype/list occur; do not drop or fabricate those entries. OPW fields are decimal strings while the HTML shows percentages.
- `tp_id` identifies the player **inside that tournament**. Entry 509 is displayed in the link as `0509`. It is not a global player ID.
- `player_id` links to `/players/{id}`. Francisco Osorio has `player_id: 5391` in both São Paulo and Bogotá but `tp_id` 1016 and 86 respectively. The global profile for 1837 also links different entry IDs across 12 tournaments. This is direct evidence of a cross-tournament Labs identifier, not a guarantee of perfect upstream identity matching.
- Archetypes have slugs such as `regidrago-vstar`, labels such as Regidrago, and decorative icon strings. Same slug observed across two events; names/icons can change. Preserve source taxonomy instead of inferring a new classification.
- Lists use `/{tournament}/player/{entry}/decklist`; the list payload supplies count, name, set and string collector number. `decklist: 1` in standings is availability, not the list itself.
- Tournament metadata supplies `rk9_id` or `playlatam_id`, event type, city, date label, season, country, player counts, completion state and nullable `updated_at`. In the inspected events `name` and `updated_at` are null. The proof uses the HTML title for the event name and local retrieval time for synchronization time.

### Access mechanism (verified)

Ordinary GET returns server-rendered HTML plus `<script type="application/json" data-sveltekit-fetched data-url="...">` blocks. Each is a JSON response envelope whose `body` is another JSON string containing `{ok,message}`. Parsing JSON is sufficient; no script evaluation is needed. Plain links allow direct standings, result, profile and decklist retrieval without JavaScript. JavaScript supports hydration, menus and filters; those interactive behaviors were not exhaustively tested.

Observed public structured URLs:

```text
https://mew.limitlesstcg.com/labs/data/tcg/tournament?id=0009&division=MA
https://mew.limitlesstcg.com/labs/data/tcg/standings?tournamentId=0009&division=MA
https://mew.limitlesstcg.com/labs/data/tcg/player?tournamentId=0009&playerId=0509
https://mew.limitlesstcg.com/labs/data/tcg/matches?tournamentId=0009&playerId=0509
https://mew.limitlesstcg.com/labs/data/tcg/decklist?tournamentId=0009&playerId=0509
https://mew.limitlesstcg.com/labs/data/tcg/rankings/player?playerId=1837
https://mew.limitlesstcg.com/labs/data/tcg/rankings/finishes?season=2025&playerId=1837
```

Tournament and standings URLs were additionally requested directly: both returned HTTP 200 `application/json` without credentials. Others were observed inside public HTML, not independently tested as direct endpoints. No documented Labs API contract, rate limit, version policy, or webhook was found in this bounded investigation. This does not establish their absence. The prototype parses embedded responses; a subsequent adapter can prefer the confirmed JSON endpoints after contract/usage validation.

The HTML also embeds a failed unauthenticated `/labs/user` response. It is unrelated to public tournament ingestion; our parser ignores it and sanitizer removes it. Do not call it or attempt login.

### Provenance, reliability and limitations

**Verified:** São Paulo links RK9 pairings/roster and embeds `rk9_id: LA01mwu6ugCwMEJxWT2H`. Bogotá links PlayLATAM pairings/roster and embeds `playlatam_id: BOG25-TCG-MA`. The index attributes source availability to those providers. **Inference:** participant/match inputs originate there. The exact transformation, deck taxonomy ownership, refresh schedule, identity merge algorithm and list import chain are **unknown**; Labs computes its own standings, so a Labs placement is not automatically an official final result.

The inspected list labels Professor's Research as JTG 155 for a November 2024 event. Preserve the current public representation; do not claim set/number identifies the exact physical printing submitted at that event. Historical print normalization is an unresolved issue.

**Proposed update strategy:** manually configured completed event first, cache successful snapshots, validate schemas, retain IDs/URLs/retrieval timestamps, and stop on access errors. The experimental client spaces requests at least 1.1 seconds apart, serializes requests, caches for one hour within a client instance and has no retries. This is a conservative prototype choice, not a published allowed rate. Before recurring ingestion, establish an acceptable rate, durable snapshots/checkpoints, stale-data behavior and change detection. Check provider guidance as it evolves. The inspected Labs robots.txt contained general content-signal explanatory comments but no agent-specific rules; that alone is no production usage agreement.

**Recommended usage:** best proven source for the target in-person workflow, with source-local identity and historical-only interpretation. Automatic synchronization is technically viable for tested completed-event fields, but broad coverage, live updates, contract stability and production scheduling remain unproven.

## RK9

**Verified:** upstream opaque event identifier is shared between `/pairings/{event}` and `/roster/{event}` links. The inspected public roster is server-rendered and includes decklist links of form `/decklist/public/{event}/{opaque-participant-token}`. A public pairings page also exposes tournament rounds/results in readable HTML ([example](https://rk9.gg/pairings/LA01mwu6ugCwMEJxWT2H)). Login-related scripts exist on the site, but the inspected roster did not require authentication.

**Available data/access:** public participant names, countries, divisions, pairings and links to public lists, dependent on the event. Roster link tokens must be treated as event-scoped until persistence is proven. Do not store masked membership/player numbers or reconstruct them.

**Reliability/limitations:** upstream event provider; no public documented data API was verified, no cross-event participant key established, and direct list contents were not parsed. Publication timing, historical retention, official final standings representation and broad availability are unknown.

**Proposed update strategy:** use Labs first; retain RK9 event references for traceability and manual comparison. A future Rk9Source should use only confirmed public pages/endpoints, local fixtures and bounded cached requests. **Recommended usage:** targeted upstream validation/fallback, not identity merging by names or masked numbers.

## PlayLATAM

**Verified:** [main site](https://playlatam.net/) lists tournaments. Labs links `https://pairings.playlatam.net/matches/BOG25-TCG-MA` and `/roster/BOG25-TCG-MA`. The inspected roster returned public HTML and linked lists at `https://decklist.playlatam.net/t/BOG25-TCG-MA/{opaque-token}`.

**Available data/access:** event discovery, public roster and public list links; pairings link observed. Event key `BOG25-TCG-MA` encodes human-readable hints, but treat it as opaque. Participant list token stability across events is unknown. Direct pairings/list contents and any documented JSON API were not verified.

**Reliability/limitations:** confirmed upstream for this Labs event; retention, taxonomy, refresh guarantees, stable player identity and complete data coverage remain unknown. Main site registration/login features are outside scope.

**Proposed update strategy:** retain upstream event IDs; use Labs as initial normalized source. Build an independent PlayLatamSource only after a representative public pairings/list contract is tested. **Recommended usage:** targeted public upstream checks; no authenticated registration/account data.

## Prototype boundaries and next milestone

The adapter separates HTTP retrieval, HTML/embedded-JSON parsing and domain mapping, behind TournamentDataSource. One live standings capture and one list prove Tournament -> Player -> TournamentEntry/result -> Deck/archetype -> DeckCard. Offline fixtures retain five actual entries and one complete list; capture URLs, timestamps and original hashes are in `test/fixtures/manifest.json`. Trackers, executable scripts and account payloads were removed. This is a selected sample, never a complete event snapshot. Tests do not contact the website.

Unknowns blocking a production schema/scheduler: source-side identity corrections/duplicates, division edge cases, incomplete and live events, card-print normalization, endpoint stability, usage agreement/rate limits and update semantics. Do not claim current deck knowledge from this history.

**Recommended next milestone:** validate a small manually selected set of completed events across RK9 and PlayLATAM origins, divisions and missing-list cases; investigate direct JSON contracts and identity ambiguity; then add idempotent persistence and synchronization of those validated fields. No UI or predictions yet.

## Validation performed

On 2026-10-14:

- `pnpm test`: 11 offline tests passed, zero failures; no live source dependency.
- `pnpm typecheck`: passed.
- `pnpm scout:proof`: passed using five selected fixture entries and one 60-card list.
- `pnpm scout:proof --live https://labs.limitlesstcg.com/0009/standings`: passed using 1810 parsed entries and one 60-card list (26 card rows). First result: miloslav posledni, CZ, placement 1, record 14-2-0, Regidrago.

The live run was a bounded manual verification, not a scheduled synchronization job. Successful checks establish this event's pipeline, not universal reliability across all tournaments.

## Milestone 2 — additional verification (2026-10-14)

A bounded sample beyond São Paulo was fetched through normal public HTTP: [Recife 2026 Masters](https://labs.limitlesstcg.com/0075/standings), [Recife Seniors](https://labs.limitlesstcg.com/0075/SR/standings), and [Bogotá 2024 Masters](https://labs.limitlesstcg.com/0012/standings). One public decklist was inspected for each Masters event. No catalog traversal or bulk list crawling was performed.

| Sample | Reported / embedded entries | Upstream provenance in Labs metadata | List flags | Format/date observations |
| --- | --- | --- | --- | --- |
| Recife MA | 1074 / 1074 | rk9_id RE001-a2hqIrDZOyenzQ; matching public RK9 links | 1072 available | Format absent; October 3–4, 2026; season 2027; updated_at 2026-10-04 20:20:14 has no timezone |
| Recife SR | 96 / 96 | Same RK9 event ID, division SR | 96 available | Same event date; separate round and entrant counts |
| Bogotá MA | 215 / 215 | playlatam_id BOG25-TCG-MA; matching public PlayLATAM links | 212 available | Format absent; December 7–8, 2024; season 2025; updated_at null |

**Verified comparisons:** same standings field names, numeric global player_id and event-local tp_id, numeric/null placements, W/L/T and source archetype slug/name/icon representation. Null countries occur in both events (including Recife's winner); they must not be filled from the tournament's host country. Archetypes differ by historical event, e.g. Ogerpon Meganium Arboliva versus Regidrago. Both inspected Masters lists total 60 cards and contain set/string number identifiers. Seniors links include `/SR/player/.../decklist`. All sampled placements are populated; the existing São Paulo fixture still covers null placement/disqualification.

For **each** Masters sample, the discovered tournament and standings JSON endpoints were also fetched directly without credentials: HTTP 200, same metadata keys and exactly 1074 / 215 standings rows respectively. Embedded and direct response structures agree. These endpoints remain undocumented and separate from the Play tournament API. The implementation continues using the tested embedded payload path, avoiding an unneeded transport migration during the persistence milestone.

**Identity limitation verified:** searching the imported records finds Francisco Osorio / CL under Labs ID 5391 (Bogotá and São Paulo) and 57170 (Recife). This may reflect a provider/source split or different people; the investigation cannot decide. The importer creates separate players for these IDs and the query service exposes them as possible matches. Stable source IDs enable conservative aggregation, but names/country and apparent real-world continuity are insufficient to repair identity splits automatically.

**Adapter changes:** retain raw validated tournament/entry fields using Zod passthrough so source timestamps/extra metadata are not discarded; add optional nullable format/raw fields to shared contracts; retain existing HTTP throttling, caching and source separation. No format or timezone is inferred. Additional sanitized fixtures are under `packages/data-sources/test/fixtures/milestone2`, with capture URLs, timestamps, counts and provider evidence in their manifest. They contain selected rows, not full standings. No authentication/user payloads or executable scripts are included.

PostgreSQL validation and import counts are recorded in [Milestone 2 results](milestone-2.md). Production usage agreement, source correction semantics, identity splits and automatic refresh of already imported lists remain unresolved.

Milestone 2 also adds a conservative event-scoped fallback for explicit null/zero global IDs, tested with synthetic payload variants. All inspected real sample IDs were positive; this is defensive behavior, not an observation of missing IDs in those events. An absent required player_id key still fails payload validation.

## Milestone 3.5 — Limitless main site and international coverage

**Verified on 2026-10-14:** ordinary public HTTP GETs returned server-rendered HTML for the [main catalog](https://limitlesstcg.com/tournaments), two selected Asian events ([Yokohama](https://limitlesstcg.com/tournaments/569), [Korean League Final](https://limitlesstcg.com/tournaments/567)), their first available public decklists, two linked profiles and the explicit public results page for profile 7427. No account/login URL, authentication, CAPTCHA bypass, internal/private endpoint or broad crawl was used. The inspected main robots.txt had `User-agent: *` with an empty Disallow. This is an observation, not a production usage agreement.

### Available data and access

Main publishes a server-rendered results table with `data-rank`, `data-name`, `data-country` and `data-deck`. Plain links identify public profiles (`/players/{numeric-id}`), numeric archetypes with optional variant query values (`/decks/{id}?variant=...`), and lists (`/decks/list/{numeric-id}`). This differs from Labs' embedded JSON and slug taxonomy. No documented Main API or useful public JSON endpoint was verified in this bounded investigation; absence of such verification is not a claim that none exists. Basic page retrieval/navigation does not require JavaScript; optional UI sorting/language/printing interactions were not needed.

Event headings provide host country and a textual date. Main's catalog adds the exact source format label and an approximate-count marker where applicable. Both Asian pages publish only 32 result rows: Yokohama reports an approximate 5000 entrants, Korea 645. These are selected published results, never complete standings. Match points/W/L/T, division, season, disqualification and completion state are not stated in those result tables and are stored as null. A past event date is not used to invent completion or season metadata.

The catalog marks both selected Asian events `standard-jp` / Standard (JP). Korea's event note describes the included expansion range plus additional promo cards; the adapter preserves that note and does not equate this to a Western format. Yokohama's note explains a weather-related qualifier cancellation; its 5000 count remains explicitly approximate. Original notes are retained in raw source metadata. Country from a participant row is read independently: the Korean event includes players with JP country labels.

Lists contain `.decklist-column` category headings and `.decklist-card` rows with `data-set`, `data-number`, `data-lang`, quantities and card names. Both captured first lists total 60 cards. The HTML renders English printing identifiers; these are the source representation, not proof of the original physical card printing/language. Similar card names never cause printing deduplication; language also participates in reconciliation fingerprints when supplied.

### Identity, public histories and limitations

Main profile IDs are scoped to the **limitless-main** namespace. Profile 7427 links five published finishes across multiple Korean seasons, with the same profile identity and distinct event/list URLs. `/players/7427` and `/players/7427/results` expose those finishes in different orders; preserve the source order rather than assuming the first result is latest. Neither page establishes a complete competitive career. The importer does not follow history links to ingest unselected events. Profile 15369 supplies an additional Japanese public-history example.

Main, Labs and Play IDs are never equated. Original Unicode names remain unmodified; accent/punctuation search keys and similar romanizations are only review evidence. No new transliteration or cross-source identity merge is applied. Main archetype numeric IDs/variants stay separate from Labs slugs even when the display names resemble each other.

A read-only observation of [Main Worlds 2026](https://limitlesstcg.com/tournaments/515) and [Labs Worlds 2026](https://labs.limitlesstcg.com/0071/standings) verified an actual potential overlap: same host country/start date/title category and matching winner name/placement, but independent event/player IDs. The alternate Main Worlds representation was **not imported into the application database** and no additional list was fetched for it. Local fixture/database tests exercise advisory event/result duplication detection for these two representations. Candidate links preserve provenance and do not prove the same person or an additional participation.

### Reliability, update strategy and recommended use

Use `LimitlessMainSource` independently for selected public results and source-listed decklists, including Asian tournaments absent from Labs. Keep coverage, approximation, regional format, country scope and unknown fields explicit. Missing table/header/category structure fails visibly; do not fall back to assumed records. Missing format on the single fetched catalog page remains unknown; no automatic pagination is performed.

The Main adapter reuses a public HTML client with a closed path/origin allowlist, 1.3-second minimum spacing, one-hour in-memory cache, timeouts, response limits and no retries. Lists must be bound to an entry from the explicitly loaded tournament. Expansion previews do no HTTP retrieval, reject more than six selected events or one list/event, and stop after errors. Existing Labs request policy remains intact. Rate agreements, long-term markup stability, completeness by country/division, official-result reconciliation and original physical printings remain unverified. Full worldwide or Asian coverage is planned, not demonstrated by two sampled events.

The committed source selection, additional sanitized fixtures and additive migration are described in [Milestone 3.5](milestone-3.5.md). Proven host coverage expands to GB, AU, US, JP and KR while retaining the prior BR/CO events. Main's format metadata does not backfill a Labs format without independent evidence.
