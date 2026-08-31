import { describe, expect, it } from 'vitest';
import { $Enums } from '../generated/prisma/client.js';
import { sumCents, toCents } from '../lib/fixed-point.js';
import { rebuildParticipantMonthlyScore } from './participant-monthly-score-service.js';

describe('rebuildParticipantMonthlyScore', () => {
  it('soma pontos de todos os pilares calculados e marca pendentes', async () => {
    const upsertCalls: Array<Record<string, unknown>> = [];

    const tx = {
      pillarConfig: {
        findMany: async () => [
          { code: $Enums.PillarCode.SAFETY },
          { code: $Enums.PillarCode.ABSENTEEISM },
          { code: $Enums.PillarCode.PRODUCTIVITY },
        ],
      },
      employeePillarScore: {
        findMany: async () => [
          {
            weightedPoints: 14,
            pillar: { code: $Enums.PillarCode.SAFETY },
          },
          {
            weightedPoints: 6,
            pillar: { code: $Enums.PillarCode.ABSENTEEISM },
          },
        ],
      },
      employeeMonthlyScore: {
        upsert: async (args: { create: Record<string, unknown> }) => {
          upsertCalls.push(args.create);
          return args.create;
        },
      },
    };

    const calculatedAt = new Date('2026-08-01T00:00:00.000Z');
    await rebuildParticipantMonthlyScore({
      tx: tx as never,
      participantId: 'participant-1',
      programYearId: 'program-1',
      calculatedAt,
    });

    expect(upsertCalls).toHaveLength(1);
    const payload = upsertCalls[0]!;
    expect(Number(payload.totalPoints)).toBe(20);
    expect(payload.calculatedPillars).toEqual([
      $Enums.PillarCode.SAFETY,
      $Enums.PillarCode.ABSENTEEISM,
    ]);
    expect(payload.pendingPillars).toEqual([$Enums.PillarCode.PRODUCTIVITY]);
    expect(payload.isPartial).toBe(true);
    expect(sumCents([toCents(14), toCents(6)])).toBe(toCents(20));
  });
});
