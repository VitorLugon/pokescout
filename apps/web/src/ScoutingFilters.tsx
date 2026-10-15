import { useState } from 'react';
import type { ScoutingFilters as Filters } from '@tcg-scout/shared';

export const emptyFilters: Filters = { dateState: 'all', formatMode: 'all', divisionMode: 'all' };
function choice(mode: 'all' | 'known' | 'unknown', value?: string) { return mode === 'known' && value !== undefined ? `value:${value}` : mode; }
export function ScoutingFilters({ options, apply }: { options: { formats: (string | null)[]; divisions: (string | null)[] }; apply: (filters: Filters) => void }) {
  const [draft, setDraft] = useState<Filters>(emptyFilters);
  const [error, setError] = useState('');
  function facet(field: 'format' | 'division', value: string) {
    const mode = value.startsWith('value:') ? 'known' : value as 'all' | 'known' | 'unknown';
    setDraft(previous => { const next = { ...previous, [`${field}Mode`]: mode }; delete next[field]; if (value.startsWith('value:')) next[field] = value.slice(6); return next; });
  }
  return <details className="scouting-filters"><summary>Filtrar período, formato e divisão</summary>
    <form onSubmit={event => { event.preventDefault(); if (draft.from && draft.to && draft.from > draft.to) { setError('A data inicial deve ser anterior ou igual à final.'); return; } setError(''); apply(draft); }}>
      <label>Datas do evento<select value={draft.dateState} onChange={event => { const dateState = event.target.value as Filters['dateState']; setDraft(previous => ({ ...previous, dateState, ...(dateState === 'unknown' ? { from: undefined, to: undefined } : {}) })); }}><option value="all">Todas, incluindo desconhecidas</option><option value="known">Somente datas conhecidas</option><option value="unknown">Somente datas desconhecidas</option></select></label>
      <div className="date-fields"><label>Data inicial (inclusive)<input type="date" disabled={draft.dateState === 'unknown'} value={draft.from ?? ''} onChange={event => setDraft(previous => ({ ...previous, from: event.target.value || undefined }))} /></label><label>Data final (inclusive)<input type="date" disabled={draft.dateState === 'unknown'} value={draft.to ?? ''} onChange={event => setDraft(previous => ({ ...previous, to: event.target.value || undefined }))} /></label></div>
      <p className="small muted">Um limite de período exclui datas desconhecidas. Não usamos temporada ou horário presumido.</p>
      {(['format', 'division'] as const).map(field => <label key={field}>{field === 'format' ? 'Formato da fonte' : 'Divisão da fonte'}<select aria-label={field === 'format' ? 'Formato da fonte' : 'Divisão da fonte'} value={choice(draft[`${field}Mode`], draft[field])} onChange={event => facet(field, event.target.value)}><option value="all">Todos, incluindo desconhecidos</option><option value="unknown">Somente não informados</option><option value="known">Todos os valores informados</option>{options[field === 'format' ? 'formats' : 'divisions'].filter((value): value is string => value !== null).map(value => <option value={`value:${value}`} key={value}>{value}</option>)}</select></label>)}
      {error && <p role="alert" className="flag">{error}</p>}
      <div className="filter-actions"><button type="submit" className="primary">Aplicar filtros</button><button type="button" onClick={() => { setDraft(emptyFilters); setError(''); apply(emptyFilters); }}>Limpar filtros</button></div>
    </form>
  </details>;
}
