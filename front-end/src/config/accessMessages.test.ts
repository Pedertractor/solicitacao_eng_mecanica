import { describe, expect, it } from 'vitest';
import {
  getHomeNoAccessCopy,
  getRedirectAccessDeniedCopy,
} from '@/config/accessMessages';
import type { AuthUser } from '@/types/auth';

function user(partial: Partial<AuthUser> & Pick<AuthUser, 'role'>): AuthUser {
  return {
    id: '1',
    cardNumber: '123',
    unit: 'PEDERTRACTOR',
    name: 'Ana',
    ...partial,
  };
}

describe('accessMessages', () => {
  it('explains missing pillars for responsible', () => {
    const copy = getHomeNoAccessCopy(user({ role: 'RESPONSIBLE' }));
    expect(copy.title).toMatch(/pilar/i);
    expect(copy.description).toMatch(/administrador/i);
  });

  it('explains limited profile for user', () => {
    const copy = getHomeNoAccessCopy(user({ role: 'USER' }));
    expect(copy.title).toBe('Acesso limitado');
    expect(copy.description).toMatch(/usuário/i);
  });

  it('uses generic deny when responsible already has pillars', () => {
    const copy = getRedirectAccessDeniedCopy(
      user({ role: 'RESPONSIBLE', assignedPillarCodes: ['SAFETY'] }),
    );
    expect(copy.title).toBe('Sem permissão');
  });
});
