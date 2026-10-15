import type { EvidenceResult, EvidenceTournament } from '@tcg-scout/shared';
import { SourceLink } from './components';
import { coverageLabel, sourceName, timestamp, unknown } from './presentation';
import { CoverageHelp } from './CoverageHelp';

export function EventEvidence({ event }: { event: EvidenceTournament }) {
  return <>
    <h3>{event.name}</h3>
    <p className="small"><strong>{sourceName(event.source)}</strong> · ID {event.externalId}</p>
    <p className="small">{event.dateLabel || unknown} · País anfitrião: {event.country ?? unknown}</p>
    <p className="small">Divisão: {event.division ?? unknown} · Formato: {event.format ?? unknown}</p>
    <p className="coverage">{coverageLabel(event.resultsCoverage)}</p>
    {!event.fullySynchronized && <p className="small muted">Importação parcial: resultados ou listas podem estar ausentes.</p>}
    <CoverageHelp />
    <div className="provenance"><SourceLink url={event.sourceUrl}>Torneio na fonte</SourceLink><span>Dados do evento obtidos em {timestamp(event.lastSyncedAt)}</span></div>
  </>;
}
export function ResultEvidence({ entry, overlap = false }: { entry: EvidenceResult; overlap?: boolean }) {
  return <article className="evidence-result">
    {overlap && <p className="flag">Ambas as identidades têm resultado neste mesmo registro de evento. Isso não determina se são a mesma pessoa.</p>}
    <EventEvidence event={entry.tournament} />
    <dl className="facts">
      <div><dt>Nome no resultado</dt><dd>{entry.originalName}</dd></div>
      <div><dt>ID do resultado na fonte</dt><dd>{entry.externalId}</dd></div>
      <div><dt>País do jogador informado</dt><dd>{entry.country ?? unknown}</dd></div>
      <div><dt>Colocação</dt><dd>{entry.placement === null ? unknown : `#${entry.placement}`}</dd></div>
      <div><dt>Arquétipo histórico</dt><dd><PokemonSprites name={entry.archetypeName} />{entry.archetypeName ?? unknown}</dd></div>
    </dl>
    <div className="provenance"><SourceLink url={entry.sourceUrl}>Resultado na fonte</SourceLink><span>Resultado obtido em {timestamp(entry.lastSyncedAt)}</span></div>
  </article>;
}
import { PokemonSprites } from './PokemonSprites';
