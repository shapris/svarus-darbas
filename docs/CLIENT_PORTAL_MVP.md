# Klientų portalas — MVP apimtis

**MVP (minimalus naudingas rinkinys):**

1. Prisijungimas el. paštu / slaptažodžiu (arba invite).
2. Užsakymų sąrašas ir būsena (skaitymui).
3. Registracija / atkūrimas — tik jei įjungta `VITE_CLIENT_SELF_REGISTRATION` ir Supabase Auth sutvarkytas (redirect URL).

**Ne MVP (plėtra vėliau):** pertekliniai žingsniai be verslo poreikio — laikyti už nustatymų vėliavėlių. Techniniai entry: [`src/views/ClientPortal/`](../src/views/ClientPortal/), [`docs/DEPLOY.md`](DEPLOY.md).
