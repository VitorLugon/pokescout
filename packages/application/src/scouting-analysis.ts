import type { ArchetypeGroup, ScoutingEntry, ScoutingFilters } from '@tcg-scout/shared';
import { calendarDate } from './scouting-filters.js';

export function archetypeKey(entry: ScoutingEntry): string {
  const deck = entry.deck;
  if (deck?.archetypeId?.trim()) return JSON.stringify([deck.source, 'id', deck.archetypeId]);
  if (deck?.archetypeName?.trim()) return JSON.stringify([deck.source, 'label', deck.archetypeName]);
  return 'unknown';
}
export function possibleDuplicate(entry: ScoutingEntry): boolean {
  return entry.duplicateResultsAsA.length + entry.duplicateResultsAsB.length + entry.tournament.duplicateEventsAsA.length + entry.tournament.duplicateEventsAsB.length > 0;
}
function matchesValue(value: string | null, mode: 'all' | 'known' | 'unknown', literal?: string) {
  return mode === 'all' || (mode === 'unknown' ? value === null : value !== null && (literal === undefined || value === literal));
}
export function analyzeScouting(rows: ScoutingEntry[], filters: ScoutingFilters) {
  const interval = !!(filters.from || filters.to);
  const base = rows.filter(entry => matchesValue(entry.tournament.format, filters.formatMode, filters.format) && matchesValue(entry.tournament.division, filters.divisionMode, filters.division));
  const excludedUnknownDateByPeriod = interval ? base.filter(entry => calendarDate(entry.tournament.eventDate) === null).length : 0;
  const matched = base.filter(entry => {
    const date = calendarDate(entry.tournament.eventDate);
    if (interval && (!date || filters.from && date < filters.from || filters.to && date > filters.to)) return false;
    return filters.dateState === 'all' || (filters.dateState === 'known' ? date !== null : date === null);
  });
  const duplicates = matched.filter(possibleDuplicate);
  const eligible = matched.filter(entry => !possibleDuplicate(entry));
  const known = eligible.filter(entry => archetypeKey(entry) !== 'unknown');
  const grouped = new Map<string, ScoutingEntry[]>();
  for (const entry of known) { const key = archetypeKey(entry); grouped.set(key, [...(grouped.get(key) ?? []), entry]); }
  const groups: ArchetypeGroup[] = [...grouped].map(([key, entries]) => {
    const deck = entries[0].deck!;
    const labels = [...new Set(entries.flatMap(entry => entry.deck?.archetypeName?.trim() ? [entry.deck.archetypeName] : []))];
    const events = [...new Map(entries.map(entry => [entry.tournament.id, entry.tournament])).values()];
    return { key, source: deck.source, externalId: deck.archetypeId?.trim() ? deck.archetypeId : null,
      name: labels[0] ?? null, labels, resultCount: entries.length, denominator: known.length,
      percentage: Math.round(entries.length * 1000 / known.length) / 10, eventCount: events.length,
      events: events.slice(0, 3).map(event => ({ id: event.id, name: event.name, dateLabel: event.dateLabel, eventDate: event.eventDate, country: event.country, sourceUrl: event.sourceUrl })), eventsTruncated: events.length > 3 };
  }).sort((a, b) => b.resultCount - a.resultCount || a.key.localeCompare(b.key));
  return { matched, duplicates, eligible, groups, counts: {
    availableResults: rows.length, matchingResults: matched.length, excludedUnknownDateByPeriod,
    excludedPossibleDuplicates: duplicates.length, eligibleResults: eligible.length,
    knownArchetypeResults: known.length, unknownArchetypeResults: eligible.length - known.length,
  } };
}
