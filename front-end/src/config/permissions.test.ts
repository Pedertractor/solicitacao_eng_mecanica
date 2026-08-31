import { describe, expect, it } from 'vitest';
import {
  canAccessP5Area,
  canEditPillar,
  canViewPillar,
} from '@/config/permissions';

describe('permissions', () => {
  it('allows admin full P5 access', () => {
    expect(canAccessP5Area({ role: 'ADMIN' })).toBe(true);
    expect(canViewPillar({ role: 'ADMIN' }, 'SAFETY')).toBe(true);
    expect(canEditPillar({ role: 'ADMIN' }, 'SAFETY')).toBe(true);
  });

  it('requires pillars for responsible P5 access', () => {
    expect(canAccessP5Area({ role: 'RESPONSIBLE' })).toBe(false);
    expect(
      canAccessP5Area({
        role: 'RESPONSIBLE',
        assignedPillarCodes: ['SAFETY'],
      }),
    ).toBe(true);
  });

  it('blocks safety edit for responsible', () => {
    expect(
      canEditPillar(
        {
          role: 'RESPONSIBLE',
          assignedPillarCodes: ['SAFETY', 'PRODUCTIVITY'],
        },
        'SAFETY',
      ),
    ).toBe(false);
    expect(
      canEditPillar(
        {
          role: 'RESPONSIBLE',
          assignedPillarCodes: ['PRODUCTIVITY'],
        },
        'PRODUCTIVITY',
      ),
    ).toBe(true);
  });

  it('filters view by assigned pillars', () => {
    expect(
      canViewPillar(
        {
          role: 'RESPONSIBLE',
          assignedPillarCodes: ['QUALITY_5S'],
        },
        'SAFETY',
      ),
    ).toBe(false);
  });

  it('admin views absenteeism', () => {
    expect(canViewPillar({ role: 'ADMIN' }, 'ABSENTEEISM')).toBe(true);
  });

  it('responsible views assigned absenteeism', () => {
    expect(
      canViewPillar(
        {
          role: 'RESPONSIBLE',
          assignedPillarCodes: ['ABSENTEEISM'],
        },
        'ABSENTEEISM',
      ),
    ).toBe(true);
  });

  it('responsible with multiple pillars views absenteeism when assigned', () => {
    expect(
      canViewPillar(
        {
          role: 'RESPONSIBLE',
          assignedPillarCodes: ['SAFETY', 'ABSENTEEISM'],
        },
        'ABSENTEEISM',
      ),
    ).toBe(true);
  });

  it('responsible without absenteeism cannot view it', () => {
    expect(
      canViewPillar(
        {
          role: 'RESPONSIBLE',
          assignedPillarCodes: ['SAFETY'],
        },
        'ABSENTEEISM',
      ),
    ).toBe(false);
  });
});
