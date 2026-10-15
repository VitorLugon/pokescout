import { Prisma, type PrismaClient } from '@tcg-scout/database';
import { nameSearchKey, normalizeName, type TournamentEntry } from '@tcg-scout/shared';
type Transaction = Prisma.TransactionClient;
export const json = (value: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

export async function saveEntry(tx: Transaction, tournamentId: string, entry: TournamentEntry) {
  const ref = entry.player.reference;
  const scope = entry.player.identityScope ?? (ref.source === 'limitless-labs' ? 'global' : `entry:${tournamentId}`);
  const identityKey = { source: ref.source, scope, externalId: ref.externalId };
  // Serializes this identity only, including appearances imported in different events.
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${JSON.stringify(identityKey)}, 0))::text`;
  let identity = await tx.sourceIdentity.findUnique({ where: { source_scope_externalId: identityKey } });
  if (!identity) {
    identity = await tx.sourceIdentity.create({ data: {
      ...identityKey, sourceUrl: ref.sourceUrl, lastSyncedAt: new Date(ref.lastSyncedAt),
      player: { create: { displayName: entry.player.originalName } },
    } });
  } else {
    await tx.sourceIdentity.update({ where: { id: identity.id }, data: { sourceUrl: ref.sourceUrl, lastSyncedAt: new Date(ref.lastSyncedAt) } });
  }
  const previous = await tx.tournamentEntry.findUnique({ where: { tournamentId_externalId: { tournamentId, externalId: entry.tournamentPlayerId } } });
  if (previous && previous.playerId !== identity.playerId) throw new Error('Source identity changed for an existing entry; manual reconciliation required');
  const alias = { originalName: entry.player.originalName, normalizedName: normalizeName(entry.player.originalName), searchKey: nameSearchKey(entry.player.originalName), source: ref.source, sourceUrl: entry.reference.sourceUrl, lastSyncedAt: new Date(ref.lastSyncedAt) };
  await tx.playerAlias.upsert({ where: { playerId_originalName: { playerId: identity.playerId, originalName: alias.originalName } }, create: { ...alias, playerId: identity.playerId }, update: alias });
  const data = {
    playerId: identity.playerId, originalName: entry.player.originalName,
    country: entry.country ?? previous?.country ?? null,
    placement: entry.placement ?? (entry.disqualified ? null : previous?.placement ?? null),
    points: entry.points ?? previous?.points ?? null, wins: entry.record.wins ?? previous?.wins ?? null, losses: entry.record.losses ?? previous?.losses ?? null, ties: entry.record.ties ?? previous?.ties ?? null,
    disqualified: entry.disqualified ?? previous?.disqualified ?? null, sourceUrl: entry.reference.sourceUrl,
    lastSyncedAt: new Date(entry.reference.lastSyncedAt), raw: json(entry.raw ?? entry),
  };
  const saved = await tx.tournamentEntry.upsert({ where: { tournamentId_externalId: { tournamentId, externalId: entry.tournamentPlayerId } }, create: { ...data, tournamentId, externalId: entry.tournamentPlayerId }, update: data });
  const oldDeck = await tx.deck.findUnique({ where: { entryId: saved.id } });
  const incoming = entry.deck;
  const deckData = {
    externalId: incoming?.reference.externalId ?? entry.reference.externalId,
    source: entry.reference.source, sourceUrl: incoming?.reference.sourceUrl ?? entry.reference.sourceUrl,
    lastSyncedAt: new Date(entry.reference.lastSyncedAt),
    archetypeId: incoming?.archetype?.externalId ?? oldDeck?.archetypeId ?? null,
    archetypeName: incoming?.archetype?.name ?? oldDeck?.archetypeName ?? null,
    decklistUrl: incoming?.decklistUrl ?? oldDeck?.decklistUrl ?? null,
    availableAtSource: entry.decklistAvailable,
    // A missing upstream field never discards a previously imported list.
    listStatus: oldDeck?.listImportedAt ? 'IMPORTED' as const : entry.decklistAvailable ? 'AVAILABLE' as const : 'UNAVAILABLE' as const,
  };
  await tx.deck.upsert({ where: { entryId: saved.id }, create: { ...deckData, entryId: saved.id }, update: deckData });
}

export async function saveDecklist(db: PrismaClient, deckId: string, cards: { count: number; name: string; category: string; set: string; number: string; language?: string | null }[], raw: unknown, importedAt: Date) {
  await db.$transaction(async tx => {
    await tx.deckCard.deleteMany({ where: { deckId } });
    await tx.deckCard.createMany({ data: cards.map((card, position) => ({ deckId, position, quantity: card.count, name: card.name, category: card.category, setCode: card.set, collectorNumber: card.number, language: card.language ?? null })) });
    await tx.deck.update({ where: { id: deckId }, data: { listStatus: 'IMPORTED', listImportedAt: importedAt, lastListAttemptAt: new Date(), lastListError: null, rawList: json(raw) } });
  }, { timeout: 15000 });
}
