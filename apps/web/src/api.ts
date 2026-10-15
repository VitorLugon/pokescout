import type { HistoricalDeck, PlayerHistoryResponse, PlayerSearchResponse, IdentityComparison, DuplicateEvidence, ScoutingFilters, ScoutingSummary, ScoutingEvidence, ScoutingScope } from '@tcg-scout/shared';
import type { TournamentCatalogResponse } from '@tcg-scout/shared';

export class ApiError extends Error {
  constructor(readonly status: number) { super('Não foi possível consultar a API. Tente novamente.'); }
}
const baseUrl = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');
function scoutingParams(filters: ScoutingFilters) {
  return Object.fromEntries(Object.entries(filters).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
}
async function get<T>(path: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, { signal, headers: { Accept: 'application/json' } });
  if (!response.ok) throw new ApiError(response.status);
  return response.json() as Promise<T>;
}
export const api = {
  tournaments: (offset: number, signal: AbortSignal, preferred=false) => get<TournamentCatalogResponse>(`/tournament-catalog?limit=20&offset=${offset}${preferred?'&view=labs-first':''}`, signal),
  scouting: (id: string, filters: ScoutingFilters, signal: AbortSignal) => get<ScoutingSummary>(`/players/${encodeURIComponent(id)}/scouting?${new URLSearchParams(scoutingParams(filters))}`, signal),
  scoutingEvidence: (id: string, filters: ScoutingFilters, selection: { scope: ScoutingScope; group?: string; offset: number }, signal: AbortSignal) => get<ScoutingEvidence>(`/players/${encodeURIComponent(id)}/scouting/evidence?${new URLSearchParams({ ...scoutingParams(filters), scope: selection.scope, ...(selection.group !== undefined ? { group: selection.group } : {}), offset: String(selection.offset), limit: '10' })}`, signal),
  compare: (a: string, b: string, signal: AbortSignal) => get<IdentityComparison>(`/identity-reviews/compare?${new URLSearchParams({ playerAId: a, playerBId: b, view: 'summary' })}`, signal),
  duplicate: (kind: 'event' | 'result', id: string, signal: AbortSignal) => get<DuplicateEvidence>(`/duplicate-candidates/${kind}/${encodeURIComponent(id)}`, signal),
  search: (name: string, signal: AbortSignal, preferred=false) => get<PlayerSearchResponse>(`/players?${new URLSearchParams({ name, limit: '30',...(preferred?{view:'labs-first'}:{}) })}`, signal),
  history: (id: string, offset: number, signal: AbortSignal, combined = false) => get<PlayerHistoryResponse>(`/players/${encodeURIComponent(id)}/history?limit=10&offset=${offset}${combined ? '&view=same-name' : ''}`, signal),
  decklist: (id: string, signal: AbortSignal) => get<HistoricalDeck>(`/entries/${encodeURIComponent(id)}/decklist`, signal),
};
