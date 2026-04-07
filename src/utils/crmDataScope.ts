import type { UserProfile } from '../types';

/**
 * Supabase CRM lentelių owner_id filtrui: įmonės savininko auth uid (arba pats naudotojas).
 */
export function crmDataOwnerId(params: {
  usesLocalStorageBackend: boolean;
  userProfile: UserProfile | null;
  authUid: string;
}): string {
  if (params.usesLocalStorageBackend) return params.authUid;
  const w = params.userProfile?.workspaceOwnerId?.trim();
  if (w) return w;
  return params.authUid;
}
