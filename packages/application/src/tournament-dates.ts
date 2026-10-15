import type { PrismaClient } from '@tcg-scout/database';
import { publicEventDate } from '@tcg-scout/shared';

// Local metadata repair only. No HTTP, invented dates, or source timestamps.
export async function repairTournamentDates(db: PrismaClient, apply = false) {
  const rows = await db.tournament.findMany({
    where: { eventDate: null, source: { in: ['limitless-labs', 'limitless-main'] } },
    select: { id: true, source: true, externalId: true, division: true, dateLabel: true },
    orderBy: { id: 'asc' },
  });
  const candidates = rows.flatMap(row => {
    const eventDate = publicEventDate(row.dateLabel);
    return eventDate ? [{ ...row, eventDate }] : [];
  });
  let updated = 0;
  if (apply) {
    await db.$transaction(async tx => {
      for (const row of candidates) {
        // A concurrent sync or correction must never be overwritten.
        const result = await tx.tournament.updateMany({
          where: { id: row.id, eventDate: null, dateLabel: row.dateLabel },
          data: { eventDate: row.eventDate },
        });
        updated += result.count;
      }
    });
  }
  return { apply, examined: rows.length, unresolved: rows.length - candidates.length, updated, candidates };
}
