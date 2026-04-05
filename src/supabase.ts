/**
 * Supabase sluoksnis — viešas API lieka čia; įgyvendinimas `src/supabase/*`.
 */

export type { AuthUser, DatabaseRecord } from './supabase/dbTypes';
export { TABLES } from './supabase/constants';

export {
  supabase,
  isRemoteBackend,
  usesLocalStorageBackend,
  isDemoMode,
  needsBackendSetup,
  isClientSelfRegistrationEnabled,
} from './supabase/client';

export { formatSupabaseUserError } from './supabase/logging';

export {
  normalizeInvoiceFromDb,
  normalizeTransactionFromDb,
  isPaymentsTableUnavailableError,
  isInvoicesTableUnavailableError,
  type FetchPaymentsWorkspaceResult,
} from './supabase/normalize';

export { fetchPaymentsWorkspaceData, updateInvoiceStatusInSupabase } from './supabase/paymentsWorkspace';

export { checkOrdersSchemaHealth } from './supabase/ordersSchema';

export {
  getData,
  getDataById,
  addData,
  updateData,
  deleteData,
  subscribeToData,
} from './supabase/crud';

export { fetchPublicBookingSettings, submitPublicBooking } from './supabase/booking';

export {
  signUp,
  signIn,
  requestPasswordResetEmail,
  signInWithGoogle,
  signOut,
  getCurrentUser,
  onAuthStateChange,
  testConnection,
  getUserProfile,
  createDefaultProfile,
  updateUserProfile,
  getClientOrders,
  registerClientUser,
} from './supabase/authSession';

import { supabase } from './supabase/client';

export const auth = supabase?.auth;
export default supabase;
