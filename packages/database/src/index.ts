import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';
export { Prisma, PrismaClient } from './generated/prisma/client.js';
export * from './generated/prisma/enums.js';

export function createDatabase(url?: string) {
  config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)), quiet: true });
  const connectionString = url ?? process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is missing. Copy .env.example to .env and configure PostgreSQL.');
  if (!/^postgres(ql)?:\/\//.test(connectionString)) throw new Error('DATABASE_URL must be a PostgreSQL URL.');
  return new PrismaClient({ adapter: new PrismaPg({ connectionString, max: 5, connectionTimeoutMillis: 15000 }, { schema: new URL(connectionString).searchParams.get('schema') ?? 'public' }),
    transactionOptions: { maxWait: 10000, timeout: 15000 } });
}
export async function requireDatabase(db: PrismaClient) {
  try { await db.$queryRaw`SELECT 1`; }
  catch { throw new Error('PostgreSQL is unavailable. Check DATABASE_URL, run pnpm db:up, then pnpm db:migrate.'); }
}
