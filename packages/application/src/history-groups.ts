// This key deliberately preserves accents, punctuation and scripts. Search
// normalization is broader and must not establish automatic grouping.
export function historyNameKey(name: string) {
  return name.normalize('NFC').trim().replace(/\s+/gu, ' ').toLowerCase();
}

interface SourceRow { id: string; tournament: { source: string } }
interface Pair { entryAId: string; entryBId: string }
export function groupSourceResults<T extends SourceRow>(rows: T[], pairs: Pair[]) {
  const byId = new Map(rows.map(row => [row.id, row]));
  const neighbors = new Map<string, Set<string>>();
  for (const pair of pairs) {
    const a = byId.get(pair.entryAId), b = byId.get(pair.entryBId);
    if (!a || !b || a.tournament.source === b.tournament.source) continue;
    for (const [from, to] of [[a.id, b.id], [b.id, a.id]]) {
      const ids = neighbors.get(from) ?? new Set<string>(); ids.add(to); neighbors.set(from, ids);
    }
  }
  const used = new Set<string>();
  const rank = new Map(rows.map((row, index) => [row.id, index]));
  const groups: { primary: T; otherSources: T[] }[] = [];
  for (const row of rows) {
    if (used.has(row.id)) continue;
    used.add(row.id);
    const ids = neighbors.get(row.id);
    const other = ids?.size === 1 ? byId.get([...ids][0]) : undefined;
    // Ambiguous many-to-many evidence stays as separate, flagged source rows.
    if (other && !used.has(other.id) && neighbors.get(other.id)?.size === 1) {
      used.add(other.id);
      const primary = row.tournament.source === 'limitless-labs' ? row : other;
      groups.push({ primary, otherSources: [primary === row ? other : row] });
    } else groups.push({ primary: row, otherSources: [] });
  }
  return groups.sort((a,b) => rank.get(a.primary.id)! - rank.get(b.primary.id)!);
}
