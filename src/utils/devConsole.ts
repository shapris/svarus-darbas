/**
 * Klaidų logai į `console` tik dev aplinkoje arba su `VITE_DEBUG_SUPABASE=true`
 * (bendras opt-in debug flagas naršyklėje, kaip ir `logSupabaseDevError`).
 */
export function logDevError(...args: unknown[]): void {
  if (import.meta.env.DEV || import.meta.env.VITE_DEBUG_SUPABASE === 'true') {
    console.error(...args);
  }
}
