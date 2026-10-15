import type { HistoricalDeck, HistoricalEntry } from '@tcg-scout/shared';

export const unknown = 'Não informado';
const sourceNames: Record<string, string> = { 'limitless-labs': 'Limitless Labs', 'limitless-main': 'Limitless · site principal', 'limitless-api': 'Limitless Play' };
export const sourceName = (source: string) => sourceNames[source] || source;
export const categoryNames: Record<string, string> = { pokemon: 'Pokémon', trainer: 'Treinador', energy: 'Energia' };
export function recordLabel(entry: Pick<HistoricalEntry, 'wins' | 'losses' | 'ties'>) {
  if ([entry.wins, entry.losses, entry.ties].every(value => value === null)) return unknown;
  return `V ${entry.wins ?? unknown} · D ${entry.losses ?? unknown} · E ${entry.ties ?? unknown}`;
}
export function listLabel(deck: Pick<HistoricalDeck, 'listImportedAt' | 'listStatus' | 'availableAtSource'> | null) {
  if (!deck) return 'Lista não informada';
  if (deck.listImportedAt) return deck.listStatus === 'FAILED' ? 'Lista importada · atualização falhou' : 'Lista importada';
  if (deck.listStatus === 'FAILED') return 'Falha de extração · sem lista importada';
  if (deck.availableAtSource) return 'Disponível na fonte · ainda não importada';
  return 'Lista indisponível na fonte';
}
export function coverageLabel(coverage: string) {
  return coverage === 'COMPLETE_STANDINGS' ? 'Standings completos na fonte' : coverage === 'PUBLISHED_RESULTS' ? 'Cobertura parcial · resultados selecionados' : 'Cobertura não informada';
}
export function timestamp(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? unknown : date.toLocaleString('pt-BR');
}
export function publicLink(url: string): string | undefined {
  try { const parsed = new URL(url); return ['https:', 'http:'].includes(parsed.protocol) && !parsed.username && !parsed.password ? parsed.href : undefined; }
  catch { return undefined; }
}
