/**
 * Baziniai DB įrašų laukai + laisvas indeksas normalizavimui.
 * Atskirta iš `supabase.ts` dėl aiškesnio importų sluoksnio.
 */
export interface DatabaseRecord {
  id?: string;
  uid?: string;
  created_at?: string;
  updated_at?: string;
}

export interface AuthUser {
  uid: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
}
