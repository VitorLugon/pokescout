import { parseArgs } from 'node:util';
import { createDatabase, requireDatabase, type PrismaClient } from '../packages/database/src/index.js';
export { parseArgs };
export async function withDatabase(action: (db: PrismaClient) => Promise<void>) {
  let db: PrismaClient | undefined;
  try { db = createDatabase(); await requireDatabase(db); await action(db); }
  catch (error) {
    const code = (error as { code?: string }).code;
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(code === 'P2021' ? 'Database schema is missing. Run pnpm db:migrate.' : /prisma|postgres(?:ql)?:\/\//i.test(message) ? 'Database operation failed. Check PostgreSQL and migrations.' : message);
    process.exitCode = 1;
  } finally { await db?.$disconnect(); }
}
export function argumentError(error: unknown) { console.error(error instanceof Error ? error.message : 'Invalid arguments'); process.exitCode = 1; }
