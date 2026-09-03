import { describe, expect, it } from 'vitest';
import { UserService } from './user-service.js';

describe('UserService', () => {
  it('instancia o serviço', () => {
    const service = new UserService();
    expect(service).toBeInstanceOf(UserService);
  });
});
