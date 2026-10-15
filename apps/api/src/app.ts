import Fastify from 'fastify';
import { z } from 'zod';
import { nameSearchKey } from '@tcg-scout/shared';
import type { ScoutQueryService, IdentityReviewService, DuplicateQueryService, ScoutingQueryService } from '@tcg-scout/application';
import { QueryNotFoundError, scoutingFiltersSchema, scoutingEvidenceSchema } from '@tcg-scout/application';
type Queries = Pick<ScoutQueryService, 'searchPlayers' | 'playerHistory' | 'listTournaments' | 'knownDecklist'> & Partial<Pick<ScoutQueryService, 'tournamentCatalog' | 'combinedHistory' | 'preferredSearch' | 'preferredTournamentCatalog'>>;
const limit = z.coerce.number().int().min(1).max(100);
const idParams = z.object({ id: z.uuid() });
export function buildApp(queries: Queries, reviews: Pick<IdentityReviewService, 'compare' | 'compareForDisplay'>, duplicates?: Pick<DuplicateQueryService, 'detail'>, scouting?: Pick<ScoutingQueryService, 'summary' | 'evidence'>) {
  const app = Fastify({ logger: false });
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof z.ZodError) return reply.code(400).send({ error: 'Invalid request', fields: error.issues.map(issue => issue.path.join('.')) });
    if (error instanceof QueryNotFoundError) return reply.code(404).send({ error: error.message });
    return reply.code(500).send({ error: 'Internal server error' });
  });
  app.get('/health', async () => ({ status: 'ok' }));
  app.get('/players', async request => {
    const query = z.object({ name: z.string().max(200).refine(value => nameSearchKey(value).length >= 2), limit: limit.default(30), view:z.literal('labs-first').optional() }).strict().parse(request.query);
    if(query.view) {
      if(!queries.preferredSearch) throw new QueryNotFoundError('Preferred search unavailable');
      return queries.preferredSearch(query.name,query.limit);
    }
    return queries.searchPlayers(query.name, query.limit);
  });
  app.get('/players/:id/history', async request => {
    const { id } = idParams.parse(request.params);
    const { limit: take, offset, view } = z.object({ limit: limit.default(50), offset: z.coerce.number().int().min(0).max(100000).default(0), view:z.literal('same-name').optional() }).strict().parse(request.query);
    if (view) {
      if (!queries.combinedHistory) throw new QueryNotFoundError('Combined history unavailable');
      return queries.combinedHistory(id,take,offset);
    }
    return queries.playerHistory(id, take, offset);
  });
  app.get('/tournaments', async request => {
    const query = z.object({ limit: limit.default(50) }).strict().parse(request.query);
    return queries.listTournaments(query.limit);
  });
  app.get('/tournament-catalog', async request => {
    const { limit: take, offset, view } = z.object({ limit: limit.default(20), offset: z.coerce.number().int().min(0).max(100000).default(0), view:z.literal('labs-first').optional() }).strict().parse(request.query);
    if(view) {
      if(!queries.preferredTournamentCatalog) throw new QueryNotFoundError('Preferred catalog unavailable');
      return queries.preferredTournamentCatalog(take,offset);
    }
    if (!queries.tournamentCatalog) throw new QueryNotFoundError('Tournament catalog unavailable');
    return queries.tournamentCatalog(take, offset);
  });
  app.get('/entries/:id/decklist', async request => queries.knownDecklist(idParams.parse(request.params).id));
  app.get('/identity-reviews/compare', async request => {
    const query = z.object({ playerAId: z.uuid(), playerBId: z.uuid(), view: z.literal('summary').optional() }).strict().refine(value => value.playerAId !== value.playerBId).parse(request.query);
    return query.view === 'summary' ? reviews.compareForDisplay(query.playerAId, query.playerBId) : reviews.compare(query.playerAId, query.playerBId);
  });
  if (duplicates) app.get('/duplicate-candidates/:kind/:id', async request => {
    const { kind, id } = z.object({ kind: z.enum(['event', 'result']), id: z.uuid() }).strict().parse(request.params);
    z.object({}).strict().parse(request.query);
    return duplicates.detail(kind, id);
  });
  if (scouting) {
    app.get('/players/:id/scouting', async request => scouting.summary(idParams.parse(request.params).id, scoutingFiltersSchema.parse(request.query)));
    app.get('/players/:id/scouting/evidence', async request => scouting.evidence(idParams.parse(request.params).id, scoutingEvidenceSchema.parse(request.query)));
  }
  return app;
}
