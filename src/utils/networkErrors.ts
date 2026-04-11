export function isLikelyNetworkError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error || '');
  const text = msg.toLowerCase();
  return (
    text.includes('failed to fetch') ||
    text.includes('network') ||
    text.includes('fetch') ||
    text.includes('timeout') ||
    text.includes('timed out') ||
    text.includes('503') ||
    text.includes('502') ||
    text.includes('504') ||
    text.includes('cors')
  );
}

function extractRawErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  if (error && typeof error === 'object' && 'message' in error) {
    const m = (error as { message: unknown }).message;
    if (typeof m === 'string' && m.trim()) return m.trim();
  }
  return '';
}

/** Kai žinutė jau pilna ir aiški — nederėtų priekyje kartoti bendro „fallback“ teksto. */
function isSelfContainedSanitizedMessage(safe: string): boolean {
  const s = safe.trim();
  if (!s) return false;
  if (
    /^(Sesija pasibaigė|Trūksta reikiamos lentelės|Nėra teisės įrašyti|Prieigos klaida:|Įvyko)/.test(
      s
    )
  ) {
    return true;
  }
  if (s.length >= 85 && /[.?!…]$/.test(s)) return true;
  return false;
}

export function formatNetworkErrorForUser(error: unknown, fallback: string): string {
  if (isLikelyNetworkError(error)) {
    return `${fallback} Patikrinkite interneto ryšį ir bandykite dar kartą.`;
  }
  const raw = extractRawErrorMessage(error);
  if (!raw) return fallback;
  const safe = sanitizeSupabaseErrorForDisplay(raw);
  const tail = safe.trim() ? safe.trim() : raw;
  if (isSelfContainedSanitizedMessage(safe)) {
    return safe.trim();
  }
  return `${fallback} — ${tail}`.trim();
}

/**
 * Neatvaizduoti neapdoroto PostgREST / RLS teksto galutiniam vartotojui (Mokėjimai ir pan.).
 */
export function sanitizeSupabaseErrorForDisplay(message: string): string {
  const t = String(message || '').trim();
  if (!t) return '';
  const low = t.toLowerCase();

  if (low.includes('infinite recursion') && low.includes('policy')) {
    return 'Prieigos klaida: saugumo taisyklių konfliktas duomenų bazėje (RLS). Kreipkitės į administratorių — dažniausiai reikia pataisyti workspace_memberships arba susijusias politikas Supabase.';
  }
  if (low.includes('jwt expired') || low.includes('invalid jwt')) {
    return 'Sesija pasibaigė. Prisijunkite iš naujo.';
  }
  if (/relation\s+["']?[\w.]+["']?\s+does not exist/i.test(t)) {
    return 'Trūksta reikiamos lentelės. Įkelkite migracijas arba SQL schemą.';
  }

  if (
    /schema cache|all data columns were skipped|could not find.*column.*insert payload|missing-column retries/i.test(
      low
    )
  ) {
    return 'Duomenų bazės struktūra nesutampa su programa (trūksta stulpelių arba pasenęs PostgREST podas). Administratorius: paleiskite migracijas ir perkraukite Supabase schemą.';
  }

  if (/new row violates row-level security|violates row-level security policy/i.test(low)) {
    return 'Nėra teisės įrašyti šį įrašą. Patikrinkite prisijungimą ir darbo sritį (workspace). Jei kartojasi — administratoriui (RLS).';
  }

  if (
    /permission denied for table|must be owner of|42501/i.test(low) &&
    /table|relation/i.test(low)
  ) {
    return 'Nėra teisės keisti šių duomenų. Patikrinkite paskyros rolę arba kreipkitės į administratorių.';
  }

  if (/violates foreign key constraint|is not present in table/i.test(low)) {
    return 'Susietas įrašas nerastas (pvz. klientas ar darbuotojas buvo pašalintas). Atnaujinkite puslapį ir pasirinkite iš sąrašo.';
  }

  if (/duplicate key value|unique constraint/i.test(low)) {
    return 'Toks įrašas jau egzistuoja (unikalumo apribojimas).';
  }

  if (/null value in column.*violates not-null constraint|23502/i.test(low)) {
    return 'Trūksta privalomo lauko. Užpildykite visus būtinus laukus.';
  }

  if (/invalid input syntax for type uuid|invalid input value for type uuid|22p02/i.test(low)) {
    return 'Netinkamas unikalus identifikatorius (UUID). Atnaujinkite puslapį arba pasirinkite reikšmę iš sąrašo.';
  }

  if (/invalid input value for enum|violates check constraint|23514/i.test(low)) {
    return 'Netinkama lauko reikšmė (būsena ar kitas laukas). Patikrinkite pasirinkimus.';
  }

  if (t.length > 220 && /policy|postgres|postgrest|rls|42501/i.test(low)) {
    return 'Serverio klaida saugant duomenis. Jei kartojasi, patikrinkite Supabase RLS politikas ir migracijas.';
  }

  if (
    t.length > 90 &&
    /insert|update|select\(|violates|constraint|postgrest|pgrst|postgres/i.test(low)
  ) {
    return 'Įvyko serverio klaida saugant duomenis. Bandykite dar kartą; jei kartojasi — patikrinkite tinklą ir duomenų bazės teises (RLS).';
  }

  if (
    /violates|constraint|permission denied|postgrest|pgrst\d|postgres|syntax for type|foreign key/i.test(
      low
    ) &&
    t.length < 500
  ) {
    return 'Įvyko duomenų bazės klaida. Bandykite dar kartą; jei kartojasi — kreipkitės į administratorių (RLS arba migracijos).';
  }

  return t;
}
