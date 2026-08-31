import { describe, expect, it } from 'vitest';
import { $Enums } from '../generated/prisma/client.js';
import {
  assertCanAccessPillar,
  getScopedPillarCodes,
} from '../middlewares/pillar-access-middleware.js';
import { HttpError } from '../https/errors/index.js';

describe('pillar-access-middleware', () => {
  it('admin bypasses pillar checks', () => {
    expect(() =>
      assertCanAccessPillar(
        { role: $Enums.UserRole.ADMIN },
        $Enums.PillarCode.SAFETY,
        'write',
      ),
    ).not.toThrow();
  });

  it('responsible reads assigned pillar', () => {
    expect(() =>
      assertCanAccessPillar(
        {
          role: $Enums.UserRole.RESPONSIBLE,
          assignedPillarCodes: [$Enums.PillarCode.SAFETY],
        },
        $Enums.PillarCode.SAFETY,
        'read',
      ),
    ).not.toThrow();
  });

  it('responsible cannot write safety', () => {
    expect(() =>
      assertCanAccessPillar(
        {
          role: $Enums.UserRole.RESPONSIBLE,
          assignedPillarCodes: [$Enums.PillarCode.SAFETY],
        },
        $Enums.PillarCode.SAFETY,
        'write',
      ),
    ).toThrow(HttpError);
  });

  it('responsible cannot access unassigned pillar', () => {
    expect(() =>
      assertCanAccessPillar(
        {
          role: $Enums.UserRole.RESPONSIBLE,
          assignedPillarCodes: [$Enums.PillarCode.PRODUCTIVITY],
        },
        $Enums.PillarCode.SAFETY,
        'read',
      ),
    ).toThrow(HttpError);
  });

  it('admin reads absenteeism', () => {
    expect(() =>
      assertCanAccessPillar(
        { role: $Enums.UserRole.ADMIN },
        $Enums.PillarCode.ABSENTEEISM,
        'read',
      ),
    ).not.toThrow();
  });

  it('responsible reads assigned absenteeism pillar', () => {
    expect(() =>
      assertCanAccessPillar(
        {
          role: $Enums.UserRole.RESPONSIBLE,
          assignedPillarCodes: [$Enums.PillarCode.ABSENTEEISM],
        },
        $Enums.PillarCode.ABSENTEEISM,
        'read',
      ),
    ).not.toThrow();
  });

  it('responsible with multiple pillars can read absenteeism when assigned', () => {
    expect(() =>
      assertCanAccessPillar(
        {
          role: $Enums.UserRole.RESPONSIBLE,
          assignedPillarCodes: [
            $Enums.PillarCode.SAFETY,
            $Enums.PillarCode.ABSENTEEISM,
          ],
        },
        $Enums.PillarCode.ABSENTEEISM,
        'read',
      ),
    ).not.toThrow();
  });

  it('responsible without absenteeism cannot read it', () => {
    expect(() =>
      assertCanAccessPillar(
        {
          role: $Enums.UserRole.RESPONSIBLE,
          assignedPillarCodes: [$Enums.PillarCode.SAFETY],
        },
        $Enums.PillarCode.ABSENTEEISM,
        'read',
      ),
    ).toThrow(HttpError);
  });

  it('getScopedPillarCodes returns null for admin', () => {
    expect(
      getScopedPillarCodes({ role: $Enums.UserRole.ADMIN }),
    ).toBeNull();
  });

  it('getScopedPillarCodes returns assignments for responsible', () => {
    expect(
      getScopedPillarCodes({
        role: $Enums.UserRole.RESPONSIBLE,
        assignedPillarCodes: [$Enums.PillarCode.REVENUE],
      }),
    ).toEqual([$Enums.PillarCode.REVENUE]);
  });
});
