import { describe, expect, it } from 'vitest';
import { canRoleAccessPath } from '@/config/roleAccess';

describe('roleAccess safety route', () => {
  it('allows safety cycle route for responsible with SAFETY', () => {
    expect(
      canRoleAccessPath('RESPONSIBLE', '/p5/ciclos/abc/seguranca', ['SAFETY']),
    ).toBe(true);
  });

  it('denies safety cycle route for responsible without SAFETY', () => {
    expect(
      canRoleAccessPath('RESPONSIBLE', '/p5/ciclos/abc/seguranca', [
        'PRODUCTIVITY',
      ]),
    ).toBe(false);
  });

  it('allows generic cycle detail for responsible with assigned pillar', () => {
    expect(
      canRoleAccessPath('RESPONSIBLE', '/p5/ciclos/abc', ['PRODUCTIVITY']),
    ).toBe(true);
  });
});
