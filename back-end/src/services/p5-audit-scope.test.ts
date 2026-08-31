import { describe, expect, it } from 'vitest';
import { $Enums } from '../generated/prisma/client.js';
import { isAuditLogVisible } from './p5-audit-scope.js';

describe('p5-audit-scope', () => {
  it('shows global cycle events to scoped responsible', () => {
    expect(
      isAuditLogVisible(
        { action: 'CYCLE_OPEN', entityType: 'MonthlyCycle' },
        [$Enums.PillarCode.PRODUCTIVITY],
      ),
    ).toBe(true);
  });

  it('hides safety events from productivity-only responsible', () => {
    expect(
      isAuditLogVisible(
        {
          action: 'SAFETY_CALCULATE',
          entityType: 'MonthlyCycle',
          metadata: { pillarCode: 'SAFETY' },
        },
        [$Enums.PillarCode.PRODUCTIVITY],
      ),
    ).toBe(false);
  });

  it('shows safety events to safety responsible', () => {
    expect(
      isAuditLogVisible(
        {
          action: 'SAFETY_CALCULATE',
          entityType: 'MonthlyCycle',
          metadata: { pillarCode: 'SAFETY' },
        },
        [$Enums.PillarCode.SAFETY],
      ),
    ).toBe(true);
  });

  it('hides absenteeism events from safety-only responsible', () => {
    expect(
      isAuditLogVisible(
        {
          action: 'ABSENTEEISM_CALCULATE',
          entityType: 'MonthlyCycle',
          metadata: { pillarCode: 'ABSENTEEISM' },
        },
        [$Enums.PillarCode.SAFETY],
      ),
    ).toBe(false);
  });

  it('shows absenteeism events to absenteeism responsible', () => {
    expect(
      isAuditLogVisible(
        {
          action: 'ABSENTEEISM_CALCULATE',
          entityType: 'MonthlyCycle',
        },
        [$Enums.PillarCode.ABSENTEEISM],
      ),
    ).toBe(true);
  });

  it('shows absenteeism simulation to absenteeism responsible', () => {
    expect(
      isAuditLogVisible(
        {
          action: 'ABSENTEEISM_SIMULATE',
          entityType: 'MonthlyCycle',
        },
        [$Enums.PillarCode.ABSENTEEISM],
      ),
    ).toBe(true);
  });
});
