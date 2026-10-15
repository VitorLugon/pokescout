import { z } from 'zod';
import type { ScoutingFilters } from '@tcg-scout/shared';

export function calendarDate(value: string | null): string | null {
  if (!value || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value) || value.startsWith('0000-')) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : null;
}
const shape = {
  from: z.string().refine(value => calendarDate(value) !== null, 'Invalid calendar date').optional(),
  to: z.string().refine(value => calendarDate(value) !== null, 'Invalid calendar date').optional(),
  dateState: z.enum(['all', 'known', 'unknown']).default('all'),
  formatMode: z.enum(['all', 'known', 'unknown']).default('all'), format: z.string().min(1).max(200).optional(),
  divisionMode: z.enum(['all', 'known', 'unknown']).default('all'), division: z.string().min(1).max(200).optional(),
};
function refinements(value: ScoutingFilters, ctx: z.RefinementCtx) {
  if (value.from && value.to && value.from > value.to) ctx.addIssue({ code: 'custom', path: ['to'], message: 'Date interval is reversed' });
  if ((value.from || value.to) && value.dateState === 'unknown') ctx.addIssue({ code: 'custom', path: ['dateState'], message: 'Unknown dates cannot satisfy a calendar interval' });
  for (const [mode, field] of [[value.formatMode, 'format'], [value.divisionMode, 'division']] as const) {
    if (mode !== 'known' && value[field] !== undefined) ctx.addIssue({ code: 'custom', path: [field], message: 'Literal value requires known mode' });
  }
}
// known without a literal selects all reported values; unknown selects null.
export const scoutingFiltersSchema = z.object(shape).strict().superRefine(refinements);
export const scoutingEvidenceSchema = z.object({ ...shape,
  scope: z.enum(['eligible', 'duplicates', 'matched']).default('eligible'),
  group: z.string().min(1).max(2000).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  offset: z.coerce.number().int().min(0).max(100000).default(0),
}).strict().superRefine((value, ctx) => {
  refinements(value, ctx);
  if (value.group !== undefined && value.scope !== 'eligible') ctx.addIssue({ code: 'custom', path: ['group'], message: 'Archetype groups require eligible scope' });
});
