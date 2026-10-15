import type { PlayerCandidate, PlayerSearchResponse } from '@tcg-scout/shared';
import { historyNameKey } from './history-groups.js';

// Presentation grouping only. Ambiguous names and contrary reviews stay apart.
export function preferLabsPlayers(players: PlayerCandidate[], blockedPairs: Set<string> = new Set()) {
  const names = new Map<string, PlayerCandidate[]>();
  for (const player of players) {
    const key = historyNameKey(player.displayName);
    names.set(key, [...(names.get(key) ?? []), player]);
  }
  const hidden = new Set<string>();
  const alternatives = new Map<string, PlayerCandidate[]>();
  for (const group of names.values()) {
    const labs = group.filter(player => player.identities.length > 0 && player.identities.every(identity => identity.source === 'limitless-labs'));
    const main = group.filter(player => player.identities.length > 0 && player.identities.every(identity => identity.source === 'limitless-main'));
    if (group.length !== 2 || labs.length !== 1 || main.length !== 1) continue;
    if (blockedPairs.has([labs[0].id, main[0].id].sort().join(':'))) continue;
    alternatives.set(labs[0].id, [main[0]]); hidden.add(main[0].id);
  }
  return players.filter(player => !hidden.has(player.id)).map(player => ({ ...player, alternativeMatches: alternatives.get(player.id) ?? [] }));
}

export function preferredSearchResponse(response: PlayerSearchResponse, limit: number, blockedPairs: Set<string>) {
  const groups = preferLabsPlayers(response.matches, blockedPairs);
  return { matches: groups.slice(0, limit), truncated: response.truncated || groups.length > limit,
    presentation: { policy: 'labs-first' as const, inspectedMatches: response.matches.length, inspectedMatchesLimited: response.truncated } };
}
