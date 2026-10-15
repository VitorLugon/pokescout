import { useRef, useState } from 'react';
import type { ScoutingFilters as Filters, ScoutingScope } from '@tcg-scout/shared';
import { api, ApiError } from './api';
import { useQuery } from './use-query';
import { Failure, Loading } from './components';
import { sourceName } from './presentation';
import { ScoutingFilters, emptyFilters } from './ScoutingFilters';
import { ResultCard } from './ResultCard';

export function Scouting({ playerId, hidden }: { playerId: string; hidden: boolean }) {
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [selection, setSelection] = useState<{ scope: ScoutingScope; group?: string; offset: number; label: string }>({ scope: 'eligible', offset: 0, label: 'Todos os resultados elegíveis' });
  const [refresh, setRefresh] = useState(0);
  const summary = useQuery(`${playerId}:${JSON.stringify(filters)}:${refresh}`, signal => api.scouting(playerId, filters, signal));
  const evidence = useQuery(`${playerId}:${JSON.stringify(filters)}:${JSON.stringify(selection)}:${refresh}`, signal => api.scoutingEvidence(playerId, filters, selection, signal));
  const options = useRef({ formats: [] as (string | null)[], divisions: [] as (string | null)[] });
  if (summary.data) options.current = summary.data.options;
  const data = summary.data;
  const stale = data && evidence.data && data.revision !== evidence.data.revision;
  function select(scope: ScoutingScope, label: string, group?: string) { setSelection({ scope, label, ...(group !== undefined ? { group } : {}), offset: 0 }); }
  function refreshBoth() { setRefresh(value => value + 1); }
  return <section hidden={hidden} aria-labelledby="scouting-title">
    <a className="back" aria-label="Voltar ao histórico" href={`#/player/${playerId}`}>← Voltar ao histórico</a>
    <p className="eyebrow">RECORTE HISTÓRICO DA IDENTIDADE</p><h1 id="scouting-title" tabIndex={-1}>Arquétipos publicados neste recorte</h1>
    <p className="intro">{data?.player.displayName ?? 'Identidade selecionada'} · Frequências observadas em resultados de fonte. Não estimam o próximo deck.</p>
    <ScoutingFilters options={options.current} apply={value => { setFilters(value); select('eligible', 'Todos os resultados elegíveis'); }} />
    <div aria-live="polite" aria-busy={summary.status === 'loading'}>
      {summary.status === 'loading' && <Loading>Calculando resumo histórico…</Loading>}
      {summary.status === 'error' && <Failure retry={refreshBoth}>{summary.error instanceof ApiError && summary.error.status === 404 ? 'Identidade não encontrada nesta base.' : undefined}</Failure>}
      {data && <>
        <p className="small active-filters">Recorte aplicado: {filters.from ?? 'sem início'} a {filters.to ?? 'sem fim'} · datas {({ all: 'todas', known: 'conhecidas', unknown: 'desconhecidas' })[filters.dateState]} · formato {filters.format ?? ({ all: 'todos', known: 'informados', unknown: 'não informado' })[filters.formatMode]} · divisão {filters.division ?? ({ all: 'todas', known: 'informadas', unknown: 'não informada' })[filters.divisionMode]}.</p>
        <dl className="summary-counts">
          <div><dt>Atendem aos filtros</dt><dd>{data.counts.matchingResults}</dd></div>
          <div><dt>Excluídos por possível duplicação</dt><dd>{data.counts.excludedPossibleDuplicates}</dd></div>
          <div><dt>Resultados elegíveis</dt><dd>{data.counts.eligibleResults}</dd></div>
          <div><dt>Com arquétipo conhecido</dt><dd>{data.counts.knownArchetypeResults}</dd></div>
          <div><dt>Com arquétipo desconhecido</dt><dd>{data.counts.unknownArchetypeResults}</dd></div>
        </dl>
        <p className="small muted">Base desta identidade: {data.counts.availableResults} resultados publicados. Com limite de período, excluídos por data desconhecida: {data.counts.excludedUnknownDateByPeriod} (após filtros de formato/divisão).</p>
        <p className="small muted">Percentuais entre os {data.counts.knownArchetypeResults} elegíveis com arquétipo conhecido, arredondados a uma casa decimal. A soma pode diferir de 100%. Contagens não são participações únicas confirmadas.</p>
        {!data.counts.matchingResults && <p className="notice">Nenhum resultado atende aos filtros. Isso é ausência de dados neste recorte.</p>}
        {data.counts.matchingResults > 0 && !data.counts.knownArchetypeResults && <p className="notice">Nenhum arquétipo conhecido entre os resultados elegíveis. Não há denominador para percentuais.</p>}
        <ul className="archetype-groups">{data.groups.map(group => <li className="card" key={group.key}>
          <h2><PokemonSprites name={group.name} />{group.name ?? `Nome não informado · ID ${group.externalId}`}</h2><p className="small muted">{sourceName(group.source)} · {group.externalId ? `ID ${group.externalId}` : 'Rótulo literal, sem ID de arquétipo'}</p>
          {group.labels.length > 1 && <p className="small">Rótulos publicados para este ID: {group.labels.join(' · ')}</p>}
          <p><strong>{group.resultCount} de {group.denominator}</strong> resultados elegíveis com arquétipo conhecido · <strong>{group.percentage.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%</strong></p>
          <ul className="group-events">{group.events.map(event => <li key={event.id}>{event.name} · {event.dateLabel} · País anfitrião: {event.country ?? 'Não informado'}</li>)}</ul>
          {group.eventsTruncated && <p className="small muted">Amostra de eventos; {group.eventCount} registros de evento no grupo. Abra as evidências para consultar todos os resultados.</p>}
          <button className="button" onClick={() => select('eligible', group.name ?? 'Arquétipo sem nome publicado', group.key)}>Ver resultados de {group.name ?? group.externalId}</button>
        </li>)}</ul>
        <div className="evidence-actions"><button onClick={() => select('eligible', 'Todos os resultados elegíveis')}>Todos os elegíveis</button><button onClick={() => select('eligible', 'Arquétipo desconhecido', 'unknown')}>Arquétipos desconhecidos ({data.counts.unknownArchetypeResults})</button><button onClick={() => select('duplicates', 'Excluídos por possível duplicação')}>Ver possíveis duplicações ({data.counts.excludedPossibleDuplicates})</button><button onClick={() => select('matched', 'Todos os resultados que atendem aos filtros')}>Todos os resultados filtrados</button></div>
        <p className="small muted">Exclusões por duplicação são conservadoras: não confirmam duplicação e não removem resultados do histórico.</p>
      </>}
    </div>
    <section aria-labelledby="scouting-evidence-title"><h2 id="scouting-evidence-title" tabIndex={-1}>{selection.label}</h2>
      {evidence.status === 'loading' && <Loading>Carregando evidências do recorte…</Loading>}
      {evidence.status === 'error' && <Failure retry={evidence.retry} />}
      {stale && <div className="notice" role="status"><p>Os dados mudaram entre as consultas. Atualize o recorte para reconciliar contagens e evidências.</p><button onClick={refreshBoth}>Atualizar recorte</button></div>}
      {summary.status === 'success' && evidence.data && !stale && <>
        <p className="small">{evidence.data.total} resultados publicados de fonte neste conjunto.</p>
        {!evidence.data.entries.length && <p className="notice">Nenhuma evidência neste conjunto.</p>}
        <ul>{evidence.data.entries.map(entry => <ResultCard key={entry.id} entry={entry} playerId={playerId} basePath={`#/player/${playerId}/scouting`} />)}</ul>
        <nav aria-label="Páginas das evidências" className="pagination"><button disabled={selection.offset === 0} onClick={() => setSelection(previous => ({ ...previous, offset: Math.max(0, previous.offset - evidence.data!.limit) }))}>← Anterior</button><span>Página {Math.floor(evidence.data.offset / evidence.data.limit) + 1}</span><button disabled={!evidence.data.truncated} onClick={() => setSelection(previous => ({ ...previous, offset: previous.offset + evidence.data!.limit }))}>Próxima →</button></nav>
      </>}
    </section>
  </section>;
}
import { PokemonSprites } from './PokemonSprites';
