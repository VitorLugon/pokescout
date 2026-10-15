import type { PrismaClient } from '@tcg-scout/database';
import { nameSearchKey, publicEventDate } from '@tcg-scout/shared';
import { json } from './persistence.js';
interface EventEvidence { source: string; sourceUrl: string; country: string | null; eventDate?: string | null; dateLabel: string; name: string; division: string | null; raw?: unknown }
const relatedUrls = (event: EventEvidence): string[] => {
  const raw = event.raw as { relatedSourceUrls?: unknown } | null;
  return Array.isArray(raw?.relatedSourceUrls) ? raw.relatedSourceUrls.filter((url): url is string => typeof url === 'string') : [];
};
export function eventDuplicateSignals(a: EventEvidence, b: EventEvidence): string[] {
  if (a.source === b.source || (a.division !== null && b.division !== null && a.division !== b.division)) return [];
  if (relatedUrls(a).includes(b.sourceUrl) || relatedUrls(b).includes(a.sourceUrl)) return ['explicit-public-source-link'];
  const dateA = a.eventDate ?? publicEventDate(a.dateLabel), dateB = b.eventDate ?? publicEventDate(b.dateLabel);
  if (!dateA || dateA !== dateB || !a.country || a.country !== b.country) return [];
  const words = (name: string) => nameSearchKey(name).split(' ').filter(word => !/^(regional|championships?|international|world|event|special|\d+|naic|euic|ocic)$/.test(word));
  const world = /\bworld\b/i.test(a.name) && /\bworld\b/i.test(b.name);
  const meaningfulOverlap = words(a.name).some(word => words(b.name).includes(word));
  return world || meaningfulOverlap ? ['same-calendar-start', 'same-event-country', world ? 'world-title' : 'overlapping-location-title', 'requires-human-review'] : [];
}

// Advisory candidates only: source rows, player identities and ownership never merge.
export async function detectSourceDuplicates(db: PrismaClient, tournamentId: string) {
  const event = await db.tournament.findUniqueOrThrow({ where: { id: tournamentId } });
  const others = await db.tournament.findMany({ where: { source: { not: event.source } } });
  for (const other of others) {
    const signals = eventDuplicateSignals(event, other);
    if (!signals.length) continue;
    const [tournamentAId, tournamentBId] = [event.id, other.id].sort();
    const evidence = json({ status: 'POSSIBLE', signals, sources: [event, other].map(item => ({ source: item.source, externalId: item.externalId, sourceUrl: item.sourceUrl, dateLabel: item.dateLabel, division: item.division })) });
    const candidate = await db.tournamentDuplicateCandidate.upsert({ where: { tournamentAId_tournamentBId: { tournamentAId, tournamentBId } }, create: { tournamentAId, tournamentBId, evidence }, update: { evidence } });
    const entries = await db.tournamentEntry.findMany({ where: { tournamentId: { in: [event.id, other.id] } } });
    const right = new Map<string, typeof entries>();
    for (const entry of entries.filter(row => row.tournamentId === other.id)) {
      const key = nameSearchKey(entry.originalName);
      right.set(key, [...(right.get(key) ?? []), entry]);
    }
    const writes: { entryAId: string; entryBId: string; tournamentCandidateId: string; evidence: ReturnType<typeof json> }[] = [];
    for (const entry of entries.filter(row => row.tournamentId === event.id)) {
      for (const match of right.get(nameSearchKey(entry.originalName)) ?? []) {
        if (entry.placement !== null && match.placement !== null && entry.placement !== match.placement) continue;
        const [entryAId, entryBId] = [entry.id, match.id].sort();
        const resultEvidence = json({ status: 'POSSIBLE', signals: ['candidate-event-pair', 'normalized-name-candidate'], placement: [entry.placement, match.placement], countries: [entry.country, match.country], sourceUrls: [entry.sourceUrl, match.sourceUrl], confirmedSamePerson: false, confirmedAdditionalParticipation: false });
        writes.push({ entryAId, entryBId, tournamentCandidateId: candidate.id, evidence: resultEvidence });
      }
    }
    const existing = new Map((await db.resultDuplicateCandidate.findMany({ where: { tournamentCandidateId: candidate.id }, select: { entryAId: true, entryBId: true, evidence: true } })).map(row => [JSON.stringify([row.entryAId,row.entryBId]), row.evidence]));
    const pending = writes.filter(write => !existing.has(JSON.stringify([write.entryAId,write.entryBId])));
    // A bounded insert avoids one durable transaction per candidate in a large public top cut.
    for (let offset = 0; offset < pending.length; offset += 500) await db.resultDuplicateCandidate.createMany({ data: pending.slice(offset, offset + 500), skipDuplicates: true });
    const signature = (value: unknown) => JSON.stringify(value && typeof value === 'object' && !Array.isArray(value) ? Object.entries(value).sort(([a],[b]) => a.localeCompare(b)) : value);
    const changed = writes.filter(write => { const key=JSON.stringify([write.entryAId,write.entryBId]);return existing.has(key) && signature(existing.get(key)) !== signature(write.evidence); });
    for (let offset = 0; offset < changed.length; offset += 4) {
      const results = await Promise.allSettled(changed.slice(offset, offset + 4).map(write => db.resultDuplicateCandidate.update({ where: { entryAId_entryBId: { entryAId: write.entryAId, entryBId: write.entryBId } }, data: { evidence: write.evidence } })));
      const failure = results.find(result => result.status === 'rejected');
      if (failure?.status === 'rejected') throw failure.reason;
    }
  }
}
