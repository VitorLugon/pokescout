import type { ScoutingEntry, HistoricalEntry } from '@tcg-scout/shared';
import { coverageLabel, listLabel, recordLabel, sourceName, timestamp, unknown } from './presentation';
import { SourceLink } from './components';
import { CoverageHelp } from './CoverageHelp';
import { PokemonSprites } from './PokemonSprites';
export function ResultCard({ entry, playerId, basePath = `#/player/${playerId}` }: { entry: HistoricalEntry | ScoutingEntry; playerId: string; basePath?: string }) {
  const event = entry.tournament;
  const duplicateResult = [...entry.duplicateResultsAsA, ...entry.duplicateResultsAsB].length > 0;
  const duplicateEvent = [...event.duplicateEventsAsA, ...event.duplicateEventsAsB].length > 0;
  const otherSources = 'otherSources' in entry ? entry.otherSources : undefined;
  return <li className="card result">
    <div className="result-top"><span className="eyebrow">{sourceName(event.source)} · {event.externalId}</span><span className="placement">{entry.placement === null ? 'Colocação não informada' : `#${entry.placement}`}</span></div>
    <h2>{event.name}</h2>
    <p className="muted small">{event.dateLabel || unknown} · País anfitrião: {event.country ?? unknown}</p>
    <div className="deck-summary"><p className="eyebrow">ARQUÉTIPO HISTÓRICO</p><h3><PokemonSprites name={entry.deck?.archetypeName} />{entry.deck?.archetypeName ?? unknown}</h3><p className="small">{listLabel(entry.deck)}</p>
      {entry.deck?.listImportedAt && <a className="button" href={`${basePath}/entry/${encodeURIComponent(entry.id)}`}>Abrir lista histórica <span aria-hidden="true">→</span></a>}
    </div>
    <dl className="facts">
      <div><dt>Nome no resultado</dt><dd>{entry.originalName}</dd></div>
      <div><dt>País do jogador informado</dt><dd>{entry.country ?? unknown}</dd></div>
      <div><dt>Recorde histórico</dt><dd>{recordLabel(entry)}</dd></div>
      <div><dt>Divisão / formato da fonte</dt><dd>{event.division ?? unknown} / {event.format ?? unknown}</dd></div>
    </dl>
    {entry.disqualified === true && <p className="flag">Desclassificação informada pela fonte.</p>}
    <p className="coverage">{coverageLabel(event.resultsCoverage)}</p>
    {!event.fullySynchronized && <p className="muted small">Importação parcial: resultados ou listas podem estar ausentes.</p>}
    <CoverageHelp />
    {(duplicateResult || duplicateEvent) && <p className="flag">{duplicateResult ? 'Possível resultado duplicado entre fontes.' : 'Possível evento duplicado entre fontes.'} Evidência para revisão; não confirma participação adicional.</p>}
    {duplicateResult && <ul>{[...entry.duplicateResultsAsA, ...entry.duplicateResultsAsB].map((candidate, index) => <li key={candidate.id}><a className="button" href={`${basePath}/duplicate/result/${candidate.id}`}>Consultar possível resultado duplicado {index + 1} →</a></li>)}</ul>}
    {duplicateEvent && <ul>{[...event.duplicateEventsAsA, ...event.duplicateEventsAsB].map((candidate, index) => <li key={candidate.id}><a className="button" href={`${basePath}/duplicate/event/${candidate.id}`}>Consultar possível evento duplicado {index + 1} →</a></li>)}</ul>}
    <div className="provenance"><SourceLink url={entry.sourceUrl}>Resultado na fonte</SourceLink><SourceLink url={event.sourceUrl}>Torneio na fonte</SourceLink><span>Resultado obtido em {timestamp(entry.lastSyncedAt)}</span></div>
    {!!otherSources?.some(other=>other.deck?.listImportedAt) && <p className="small">Há lista histórica importada na outra fonte. Expanda o resultado correspondente para consultá-la.</p>}
    {!!otherSources?.length && <details className="other-sources"><summary>Ver resultado correspondente na outra fonte</summary><p className="small muted">Possível duplicação agrupada para consulta. Valores e listas de cada fonte são preservados; o agrupamento não confirma identidade nem participação única.</p><ul>{otherSources.map(other => <ResultCard key={other.id} entry={other} playerId={playerId} basePath={basePath} />)}</ul></details>}
  </li>;
}

