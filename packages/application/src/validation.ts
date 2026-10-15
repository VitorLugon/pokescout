import { z } from 'zod';
import type { DeckCard, TournamentSnapshot } from '@tcg-scout/shared';

const nonnegative = z.number().int().nonnegative();
const reference = z.object({
  source: z.enum(['limitless-labs', 'limitless-main', 'limitless-api', 'rk9', 'playlatam']),
  externalId: z.string().min(1),
  sourceUrl: z.url(),
  lastSyncedAt: z.iso.datetime(),
});
export const headerSchema = z.object({
  reference,
  division: z.enum(['MA', 'SR', 'JR']).nullable(),
  name: z.string().trim().min(1),
  dateLabel: z.string().min(1),
  eventDate: z.iso.date().nullable().optional(),
  resultsCoverage: z.enum(['COMPLETE_STANDINGS', 'PUBLISHED_RESULTS', 'UNKNOWN']).default('COMPLETE_STANDINGS'),
  reportedPlayerCountApproximate: z.boolean().default(false),
  country: z.string().nullable(),
  season: nonnegative.nullable(),
  reportedPlayerCount: nonnegative.nullable(),
  completed: z.boolean().nullable(),
  upstreamIds: z.object({ rk9: z.string().nullable(), playlatam: z.string().nullable() }),
  format: z.string().nullable().optional(),
  startsAt: z.iso.datetime().nullable().optional(),
  raw: z.record(z.string(), z.unknown()).optional(),
});
const cardSchema = z.object({
  count: nonnegative.positive(),
  name: z.string().min(1),
  category: z.enum(['pokemon', 'trainer', 'energy']),
  language: z.string().min(1).nullable().optional(),
  set: z.string().min(1),
  number: z.string().min(1),
});
export const entrySchema = z.object({
  reference,
  tournamentExternalId: z.string(),
  division: z.string().nullable(),
  tournamentPlayerId: z.string().min(1),
  player: z.object({
    reference,
    originalName: z.string().min(1).refine(value => value.trim().length > 0),
    normalizedName: z.string(),
    identityScope: z.string().optional(),
  }),
  country: z.string().nullable(),
  placement: nonnegative.positive().nullable(),
  points: nonnegative.nullable(),
  record: z.object({ wins: nonnegative.nullable(), losses: nonnegative.nullable(), ties: nonnegative.nullable() }),
  disqualified: z.boolean().nullable(),
  decklistAvailable: z.boolean(),
  deck: z.object({
    reference,
    archetype: z.object({ externalId: z.string().min(1), name: z.string().min(1) }).nullable(),
    decklistUrl: z.url().nullable(),
    cards: z.array(cardSchema).nullable(),
  }).nullable(),
  raw: z.record(z.string(), z.unknown()).optional(),
});

export function validateCards(cards: DeckCard[], expectedDeckSize: number | null): DeckCard[] {
  const validated = z.array(cardSchema).min(1).parse(cards);
  const total = validated.reduce((sum, card) => sum + card.count, 0);
  if (expectedDeckSize !== null && total !== expectedDeckSize) {
    throw new Error(`Expected ${expectedDeckSize} cards, received ${total}`);
  }
  return validated;
}

export function validateEntry(entry: unknown, tournament: TournamentSnapshot['tournament']) {
  const value = entrySchema.parse(entry);
  if (value.tournamentExternalId !== tournament.reference.externalId ||
      value.division !== tournament.division ||
      value.reference.source !== tournament.reference.source ||
      value.player.reference.source !== tournament.reference.source ||
      (value.deck && value.deck.reference.source !== tournament.reference.source)) {
    throw new Error('Entry source/tournament/division mismatch');
  }
  return value;
}

export function errorSummary(error: unknown): string {
  // Never persist/log connection URLs, query parameters or full Prisma errors.
  if (/^P\d{4}$/.test((error as { code?: string } | null)?.code ?? '')) return 'Database operation failed; inspect database availability and constraints.';
  if (error instanceof z.ZodError) {
    return `Validation failed: ${error.issues.map(issue => issue.path.join('.')).join(', ')}`;
  }
  const message = error instanceof Error ? error.message : 'Unknown error';
  if (/prisma|postgres|database|ECONN|connection|P\d{4}/i.test(message)) {
    return 'Database operation failed; inspect database availability and constraints.';
  }
  return message.replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted]').slice(0, 400);
}
