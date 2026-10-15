import { useEffect, useRef, useState } from 'react';
import { Search } from './Search';
import { History } from './History';
import { Decklist } from './Decklist';
import { Comparison } from './Comparison';
import { Duplicate } from './Duplicate';
import { Scouting } from './Scouting';
import { Tournaments } from './Tournaments';

function location() {
  const path = window.location.hash;
  const duplicate = path.match(/\/duplicate\/(event|result)\/([\w-]+)$/);
  const parent = duplicate ? path.slice(0, -duplicate[0].length) : path;
  const player = parent.match(/^#\/player\/([\w-]+)(\/scouting)?(?:\/entry\/([\w-]+))?$/);
  const comparison = parent.match(/^#\/compare\/([\w-]+)\/([\w-]+)$/);
  return { path, parent, tournaments: path === '#/tournaments', playerId: player?.[1], scouting: !!player?.[2], entryId: player?.[3], a: comparison?.[1], b: comparison?.[2],
    kind: duplicate?.[1] as 'event' | 'result' | undefined, candidateId: duplicate?.[2] };
}
export function App() {
  const [route, setRoute] = useState(location);
  const previousRoute = useRef(route);
  const [scoutedPlayer, setScoutedPlayer] = useState<string>();
  useEffect(() => { if (route.scouting && route.playerId) setScoutedPlayer(route.playerId); }, [route.scouting, route.playerId]);
  useEffect(() => {
    const change = () => setRoute(location());
    window.addEventListener('hashchange', change);
    return () => window.removeEventListener('hashchange', change);
  }, []);
  useEffect(() => {
    if (previousRoute.current.path === route.path) return;
    previousRoute.current = route;
    window.scrollTo({ top: 0 });
    document.getElementById(route.tournaments ? 'tournaments-title' : route.candidateId ? 'duplicate-title' : route.a ? 'comparison-title' : route.entryId ? 'deck-title' : route.scouting ? 'scouting-title' : route.playerId ? 'history-title' : 'search-title')?.focus();
  }, [route.path]);
  return <>
    <button className="skip" onClick={() => document.getElementById('content')?.focus()}>Ir para o conteúdo</button>
    <header className="brand"><a href="#/" aria-label="PokéScout, início"><span className="brand-mark" aria-hidden="true">◒</span> PokéScout</a><nav aria-label="Navegação principal"><a href="#/" aria-current={!route.playerId && !route.a && !route.tournaments ? 'page' : undefined}>Buscar</a><a href="#/tournaments" aria-current={route.tournaments ? 'page' : undefined}>Torneios</a></nav><span className="edition"><i /> HISTÓRICO PÚBLICO</span></header>
    <main id="content" tabIndex={-1}>
      {!route.playerId && !route.a && !route.tournaments && <a className="button catalog-shortcut" href="#/tournaments">Consultar torneios importados →</a>}
      <Search hidden={!!route.playerId || !!route.a || route.tournaments} />
      {route.tournaments && <Tournaments />}
      {route.playerId && <History key={route.playerId} playerId={route.playerId} hidden={route.scouting || !!route.entryId || !!route.candidateId} />}
      {route.playerId && (route.scouting || scoutedPlayer === route.playerId) && <Scouting key={route.playerId} playerId={route.playerId} hidden={!route.scouting || !!route.entryId || !!route.candidateId} />}
      {route.playerId && route.entryId && <Decklist key={route.entryId} entryId={route.entryId} playerId={route.playerId} backUrl={route.scouting ? `#/player/${route.playerId}/scouting` : undefined} />}
      {route.a && route.b && <Comparison key={`${route.a}:${route.b}`} a={route.a} b={route.b} hidden={!!route.candidateId} />}
      {(route.playerId || route.a) && route.kind && route.candidateId && <Duplicate kind={route.kind} id={route.candidateId} parent={route.parent} />}
    </main>
    <footer>Dados históricos, escolhas informadas.<br /><span>Cobertura limitada às fontes e eventos importados.</span></footer>
  </>;
}
