import { tournamentLocation } from './limitless-labs/parser.js';
import { mainTournamentLocation } from './limitless-main/parser.js';
export function sourceLocation(url: string) {
  const parsed = new URL(url);
  if (parsed.username || parsed.password) throw new Error('Credentials are not public tournament URLs');
  const origin = parsed.origin;
  if (origin === 'https://labs.limitlesstcg.com') return { ...tournamentLocation(url), source: 'limitless-labs' as const };
  if (origin === 'https://limitlesstcg.com') return mainTournamentLocation(url);
  throw new Error('Unsupported public tournament source');
}
