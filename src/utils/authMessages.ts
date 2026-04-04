/**
 * User-facing Lithuanian copy for auth flows (Supabase).
 */

export const AUTH_FALLBACK = {
  login: 'Nepavyko prisijungti. Patikrinkite el. paštą ir slaptažodį.',
  register: 'Registracija nepavyko. Bandykite dar kartą arba kreipkitės į administratorių.',
  google:
    'Google prisijungimas nepavyko. Įsitikinkite, kad OAuth sukonfigūruotas Supabase projekte ir naršyklė neblokuoja iššokančių langų.',
} as const;

/** Short product copy for invite / help on the landing screen */
export const AUTH_INVITE_HELP = {
  staffInvite:
    'Komandos narius kvieskite čia: „Sukurti darbuotojo paskyrą“ arba administratorius sukuria paskyrą Supabase. Naudoja tą patį įmonės el. pašto domeną arba bendrą darbo paštą.',
  clientInvite:
    'Klientai gali rezervuoti be paskyros per jūsų rezervacijos nuorodą. Portalo saviregistracija įjungiama tik jei administratorius nustato VITE_CLIENT_SELF_REGISTRATION=true (hostinge).',
} as const;

const byNormalizedPhrase: [string, string][] = [
  ['invalid login credentials', 'Neteisingas el. paštas arba slaptažodis.'],
  ['invalid_credentials', 'Neteisingas el. paštas arba slaptažodis.'],
  ['email not confirmed', 'Patvirtinkite el. paštą — paspauskite nuorodą gautame laiške.'],
  ['user already registered', 'Šiuo el. paštu paskyra jau egzistuoja. Bandykite prisijungti.'],
  ['already registered', 'Šiuo el. paštu paskyra jau egzistuoja. Bandykite prisijungti.'],
  ['user already exists', 'Šiuo el. paštu paskyra jau egzistuoja.'],
  ['password should be at least', 'Slaptažodis per trumpas — naudokite bent 6 simbolius.'],
  [
    'password is known to be weak',
    'Slaptažodis per silpnas — pasirinkite ilgesnį arba unikalesnį.',
  ],
  ['signup disabled', 'Naujų paskyrų registracija išjungta. Kreipkitės į administratorių.'],
  [
    'email rate limit exceeded',
    'Per daug bandymų su el. paštu. Palaukite kelias minutes ir bandykite vėl.',
  ],
  ['rate limit', 'Per daug bandymų. Palaukite ir bandykite vėl.'],
  ['network', 'Tinklo klaida. Patikrinkite interneto ryšį.'],
  ['failed to fetch', 'Nepavyko susisiekti su serveriu. Patikrinkite ryšį.'],
  ['unable to validate email', 'Neteisingas el. pašto formatas.'],
  ['invalid email', 'Neteisingas el. pašto formatas.'],
  ['jwt expired', 'Sesija pasibaigė. Prisijunkite iš naujo.'],
  ['session', 'Sesijos klaida. Bandykite išeiti ir prisijungti iš naujo.'],
];

function norm(s: string): string {
  return s.trim().toLowerCase();
}

export function formatAuthErrorForUser(err: unknown, fallback: string): string {
  const msg =
    err && typeof err === 'object' && 'message' in err
      ? String((err as { message?: unknown }).message ?? '')
      : err instanceof Error
        ? err.message
        : String(err ?? '');

  const codeRaw =
    err && typeof err === 'object' && 'code' in err
      ? String((err as { code?: unknown }).code ?? '')
      : '';
  const code = norm(codeRaw);
  const text = norm(msg);

  for (const [needle, lt] of byNormalizedPhrase) {
    if (code.includes(needle) || text.includes(needle)) return lt;
  }

  if (msg.length > 0 && msg.length < 160 && /[ąčęėįšųūž]/i.test(msg)) {
    return msg;
  }

  return fallback;
}
