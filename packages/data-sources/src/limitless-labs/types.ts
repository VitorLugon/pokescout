import { z } from 'zod';

const integer = z.number().int().nonnegative();
const flag = z.union([z.literal(0), z.literal(1)]);
export const tournamentSchema = z.object({
  rk9_id: z.string().nullable(), playlatam_id: z.string().nullable(),
  type: z.string(), city: z.string(), name: z.string().nullable(), date: z.string(),
  season: integer, country: z.string().nullable(), players: integer.nullable(), completed: flag,
  format: z.string().nullable().optional(), utc_start: z.string().nullable().optional(),
}).passthrough();
export const standingSchema = z.object({
  player_id: integer.nullable(), tp_id: integer, name: z.string().min(1), country: z.string().nullable(),
  placement: integer.positive().nullable(), points: integer, wins: integer, losses: integer, ties: integer,
  dqed: flag, decklist: flag, deck_id: z.string().nullable(), deck_name: z.string().nullable(),
}).passthrough();
const cardSchema = z.object({ count: integer.positive(), name: z.string().min(1), set: z.string().min(1), number: z.string().min(1) });
export const decklistSchema = z.object({ pokemon: z.array(cardSchema), trainer: z.array(cardSchema), energy: z.array(cardSchema) });
export type RawStanding = z.infer<typeof standingSchema>;
export interface ParsedTournament {
  externalId: string;
  division: string;
  title: string;
  metadata: z.infer<typeof tournamentSchema>;
  standings: RawStanding[];
}
