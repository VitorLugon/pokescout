import { api, ApiError } from './api';
import { useQuery } from './use-query';
import { Failure, Loading } from './components';
import { EventEvidence, ResultEvidence } from './Evidence';
import { timestamp } from './presentation';

const signalNames: Record<string, string> = {
  'explicit-public-source-link': 'Link público explícito entre fontes', 'same-calendar-start': 'Mesma data inicial de calendário',
  'same-event-country': 'Mesmo país anfitrião', 'world-title': 'Títulos mencionam Mundial', 'overlapping-location-title': 'Local compatível nos títulos',
  'requires-human-review': 'Necessita revisão humana', 'candidate-event-pair': 'Par de eventos candidato', 'normalized-name-candidate': 'Nome normalizado compatível',
};
export function Duplicate({ kind, id, parent }: { kind: 'event' | 'result'; id: string; parent: string }) {
  const query = useQuery(`${kind}:${id}`, signal => api.duplicate(kind, id, signal));
  const data = query.data;
  return <section aria-labelledby="duplicate-title">
    <a className="back" href={parent}>← Voltar às evidências anteriores</a>
    <p className="eyebrow">PROVENIÊNCIA ENTRE FONTES</p><h1 id="duplicate-title" tabIndex={-1}>Possível {kind === 'event' ? 'evento' : 'resultado'} duplicado</h1>
    <p className="intro">Duas representações candidatas, preservadas separadamente. Não há confirmação de mesma pessoa ou participação adicional.</p>
    {query.status === 'loading' && <Loading>Carregando proveniência…</Loading>}
    {query.status === 'error' && <Failure retry={query.retry}>{query.error instanceof ApiError && query.error.status === 404 ? 'Candidato de duplicação não encontrado nesta base.' : undefined}</Failure>}
    {data && <>
      <div className="notice"><h2>Sinais registrados na detecção</h2><p className="small">Detectado em {timestamp(data.detectedAt)}. Estado: candidato para revisão.</p><ul className="signal-list">{data.signals.map((signal, index) => <li key={`${index}:${signal}`}>{signalNames[signal] ?? signal}</li>)}</ul>{!data.signals.length && <p>Sinais não informados.</p>}</div>
      <ul className="small limitations">{data.limitations.map((limitation, index) => <li key={index}>{limitation}</li>)}</ul>
      {data.results.length ? data.results.map((entry, index) => <div className="card" key={entry.id}><p className="eyebrow">REPRESENTAÇÃO {index + 1}</p><ResultEvidence entry={entry} /></div>) : data.tournaments.map((event, index) => <article className="card" key={event.id}><p className="eyebrow">REPRESENTAÇÃO {index + 1}</p><EventEvidence event={event} /></article>)}
      {data.tournamentCandidateId && <a className="button" href={`${parent}/duplicate/event/${data.tournamentCandidateId}`}>Consultar o par de eventos relacionado →</a>}
    </>}
  </section>;
}
