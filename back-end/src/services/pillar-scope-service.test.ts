import { describe, expect, it } from 'vitest';
import { $Enums } from '../generated/prisma/client.js';
import {
  computeVisiblePoints,
  computeVisiblePointsCents,
  filterPillarScores,
  visibleMaxPoints,
} from './pillar-scope-service.js';

const CONFIGS = [
  { code: $Enums.PillarCode.SAFETY, maxPoints: 20 },
  { code: $Enums.PillarCode.PRODUCTIVITY, maxPoints: 25 },
  { code: $Enums.PillarCode.QUALITY_5S, maxPoints: 20 },
  { code: $Enums.PillarCode.ABSENTEEISM, maxPoints: 10 },
  { code: $Enums.PillarCode.REVENUE, maxPoints: 25 },
];

describe('pillar-scope-service', () => {
  it('admin sees full max when no pillar scores exist', () => {
    expect(visibleMaxPoints(CONFIGS, null)).toBe(100);
    expect(
      computeVisiblePoints([], CONFIGS, null),
    ).toBe(100);
  });

  it('single assigned pillar uses max when score missing', () => {
    expect(
      computeVisiblePoints(
        [],
        CONFIGS,
        [$Enums.PillarCode.PRODUCTIVITY],
      ),
    ).toBe(25);
  });

  it('filters hidden pillar scores', () => {
    const scores = [
      { pillarCode: 'SAFETY', weightedPoints: 18 },
      { pillarCode: 'PRODUCTIVITY', weightedPoints: 22 },
    ];
    expect(
      filterPillarScores(scores, [$Enums.PillarCode.PRODUCTIVITY]),
    ).toEqual([{ pillarCode: 'PRODUCTIVITY', weightedPoints: 22 }]);
  });

  it('sums multiple assigned pillars with mixed calculated/preserved', () => {
    const scores = [
      { pillarCode: 'SAFETY', weightedPoints: 15 },
    ];
    expect(
      computeVisiblePoints(
        scores,
        CONFIGS,
        [$Enums.PillarCode.SAFETY, $Enums.PillarCode.PRODUCTIVITY],
      ),
    ).toBe(40);
  });

  it('hides safety contribution for productivity-only responsible', () => {
    const scores = [
      { pillarCode: 'SAFETY', weightedPoints: 18 },
      { pillarCode: 'PRODUCTIVITY', weightedPoints: 20 },
    ];
    expect(
      computeVisiblePointsCents(
        scores,
        CONFIGS,
        [$Enums.PillarCode.PRODUCTIVITY],
      ),
    ).toBe(2000);
  });

  it('returns zero when scope has no pillars', () => {
    expect(
      computeVisiblePoints(
        [{ pillarCode: 'SAFETY', weightedPoints: 10 }],
        CONFIGS,
        [],
      ),
    ).toBe(0);
  });
});
