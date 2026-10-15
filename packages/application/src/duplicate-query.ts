import { z } from 'zod';
import type { PrismaClient } from '@tcg-scout/database';
import type { DuplicateEvidence } from '@tcg-scout/shared';
import { QueryNotFoundError } from './errors.js';
import { eventEvidence, eventEvidenceSelect, resultEvidence, resultEvidenceSelect, evidenceSignals } from './evidence.js';

const limitations = [
  'Sinais conservadores para revisão; não confirmam identidade nem participação adicional.',
  'Datas, países e nomes podem estar incompletos ou variar entre fontes. A detecção pode omitir outros candidatos.',
  'A evidência foi registrada na detecção; os dados de fonte abaixo refletem os registros atualmente importados.',
];
export class DuplicateQueryService {
  constructor(private readonly db: PrismaClient) {}
  async detail(kind: 'event' | 'result', id: string): Promise<DuplicateEvidence> {
    z.enum(['event', 'result']).parse(kind); z.uuid().parse(id);
    if (kind === 'event') {
      const candidate = await this.db.tournamentDuplicateCandidate.findUnique({ where: { id }, select: {
        id: true, detectedAt: true, evidence: true, tournamentA: { select: eventEvidenceSelect }, tournamentB: { select: eventEvidenceSelect },
      } });
      if (!candidate) throw new QueryNotFoundError('Duplicate candidate not found');
      return { id: candidate.id, kind, status: 'POSSIBLE', detectedAt: candidate.detectedAt.toISOString(),
        signals: evidenceSignals(candidate.evidence), limitations, tournaments: [eventEvidence(candidate.tournamentA), eventEvidence(candidate.tournamentB)],
        results: [], tournamentCandidateId: null, confirmedSamePerson: false, confirmedAdditionalParticipation: false };
    }
    const candidate = await this.db.resultDuplicateCandidate.findUnique({ where: { id }, select: {
      id: true, detectedAt: true, evidence: true, tournamentCandidateId: true,
      entryA: { select: resultEvidenceSelect }, entryB: { select: resultEvidenceSelect },
    } });
    if (!candidate) throw new QueryNotFoundError('Duplicate candidate not found');
    return { id: candidate.id, kind, status: 'POSSIBLE', detectedAt: candidate.detectedAt.toISOString(),
      signals: evidenceSignals(candidate.evidence), limitations, tournaments: [eventEvidence(candidate.entryA.tournament), eventEvidence(candidate.entryB.tournament)],
      results: [resultEvidence(candidate.entryA), resultEvidence(candidate.entryB)], tournamentCandidateId: candidate.tournamentCandidateId,
      confirmedSamePerson: false, confirmedAdditionalParticipation: false };
  }
}
