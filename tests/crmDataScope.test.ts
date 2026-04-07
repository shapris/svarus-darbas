import { describe, expect, it } from 'vitest';
import { crmDataOwnerId } from '../src/utils/crmDataScope';
import type { UserProfile } from '../src/types';

describe('crmDataOwnerId', () => {
  it('uses auth uid for local backend', () => {
    expect(
      crmDataOwnerId({
        usesLocalStorageBackend: true,
        userProfile: null,
        authUid: 'local-a',
      })
    ).toBe('local-a');
  });

  it('uses workspaceOwnerId when set on cloud profile', () => {
    const p = {
      id: '1',
      uid: 'staff-1',
      email: 's@test',
      role: 'staff' as const,
      workspaceOwnerId: 'admin-9',
      createdAt: '',
    } satisfies UserProfile;
    expect(
      crmDataOwnerId({
        usesLocalStorageBackend: false,
        userProfile: p,
        authUid: 'staff-1',
      })
    ).toBe('admin-9');
  });

  it('falls back to auth uid when workspace unset', () => {
    const p = {
      id: '1',
      uid: 'solo',
      email: 'a@test',
      role: 'admin' as const,
      createdAt: '',
    } satisfies UserProfile;
    expect(
      crmDataOwnerId({
        usesLocalStorageBackend: false,
        userProfile: p,
        authUid: 'solo',
      })
    ).toBe('solo');
  });
});
