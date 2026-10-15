# TCG Scout - Codex Instructions

## Project Goal

TCG Scout is a mobile-first scouting application for competitive
Pokemon TCG players.

The primary workflow is:

1. Search for an opponent by name.
2. Identify the correct competitive player.
3. Retrieve their recent tournament history.
4. Display decks/archetypes used in recent tournaments.
5. Show available historical decklists.
6. Estimate likely archetypes based only on public historical data.

The application must never claim to know the opponent's current deck
unless that information is explicitly public.

Predictions must always be presented as estimates.

---

# Architecture

Use a monorepo architecture.

apps/web
React + TypeScript

apps/api
Fastify + TypeScript

packages/database
Prisma + PostgreSQL

packages/shared
Shared types, schemas and utilities.

packages/data-sources
External tournament data integrations.

---

# Critical Architecture Rule

External tournament websites MUST NOT be accessed directly from
controllers, routes or frontend code.

All external data access must go through adapters implementing a common
data-source interface.

Example:

TournamentDataSource
- LimitlessApiSource
- LimitlessLabsSource
- Rk9Source

This is necessary because external data sources may change.

---

# Data Collection Rules

Prefer, in order:

1. Official documented APIs
2. Public structured endpoints
3. Public HTML pages
4. HTML parsing/scraping only when necessary

Never bypass authentication, access controls, CAPTCHA, rate limits or
other technical restrictions.

Never scrape private or authenticated player information.

Only collect information publicly visible to normal website visitors.

Respect reasonable request rates.

Implement caching whenever appropriate.

---

# Source Traceability

Every imported tournament record should retain:

- source
- external identifier
- source URL
- last synchronization timestamp

When possible, retain source identifiers for players and tournaments.

Do not silently merge players solely because their names are identical.

---

# Player Identity

Player identity resolution is a critical feature.

Normalize names for search purposes, but preserve the original name.

Normalization may:

- lowercase text
- trim whitespace
- collapse repeated whitespace
- remove accents for search
- normalize punctuation

Example:

João Pedro
JOAO PEDRO
Joao Pedro

may be search matches.

However, matching names does NOT automatically mean they are the same
person.

Country, tournament history and source identifiers should be considered.

---

# Backend

Use:

- Node.js
- TypeScript
- Fastify
- Zod
- Prisma
- PostgreSQL

Routes must be thin.

Business logic belongs in services.

External integrations belong in data-source adapters.

---

# Frontend

Use:

- React
- TypeScript
- mobile-first responsive design

The primary device is a smartphone used during a tournament.

Prioritize:

- speed
- readability
- minimal number of taps
- fuzzy player search
- recent deck history

Do not create a complex dashboard for the MVP.

---

# Testing

Critical parsers must have fixture-based tests.

When parsing external HTML:

1. Save sanitized representative fixtures.
2. Parse fixtures during tests.
3. Never require the real external website for unit tests.

Test:

- tournament parsing
- player parsing
- deck parsing
- name normalization
- identity matching

---

# Code Quality

Prefer:

- small modules
- explicit types
- dependency injection
- pure parsing functions
- descriptive names

Avoid:

- giant service classes
- duplicated parsing logic
- external HTTP calls inside routes
- hard-coded tournament IDs
- hard-coded player names

---

# Scope Discipline

Do not implement AI features during the initial data ingestion milestone.

Do not implement authentication unless requested.

Do not implement payments.

Do not prematurely optimize.

The first milestone is proving reliable ingestion of:

Tournament -> Player -> Result -> Deck -> Decklist.