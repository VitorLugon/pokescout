import { createDatabase, requireDatabase } from '@tcg-scout/database';
import { ScoutQueryService, IdentityReviewService, DuplicateQueryService, ScoutingQueryService } from '@tcg-scout/application';
import { buildApp } from './app.js';
async function start() {
  const db = createDatabase();
  const app = buildApp(new ScoutQueryService(db), new IdentityReviewService(db), new DuplicateQueryService(db), new ScoutingQueryService(db));
  app.addHook('onClose', async () => { await db.$disconnect(); });
  try {
    await requireDatabase(db);
    const port = Number(process.env.API_PORT ?? process.env.PORT ?? 3001);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('API_PORT or PORT must be 1–65535');
    const address = await app.listen({ host: process.env.API_HOST ?? '127.0.0.1', port });
    console.log(`PokéScout read-only API: ${address}`);
    for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => { void app.close(); });
  } catch { await app.close(); console.error('API startup failed. Check PostgreSQL, migrations, API_HOST and API_PORT/PORT.'); process.exitCode = 1; }
}
void start();
