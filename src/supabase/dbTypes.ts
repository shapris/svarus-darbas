/**
 * Baziniai DB įrašų laukai + laisvas indeksas normalizavimui.
 * Atskirta iš `supabase.ts` dėl aiškesnio importų sluoksnio.
 */
export interface DatabaseRecord {
  id?: string;
  uid?: string;
  created_at?: string;
  updated_at?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- indeksas be `any` sulaužo „T extends DatabaseRecord“
  [key: string]: any;
}

export interface AuthUser {
  uid: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
}
