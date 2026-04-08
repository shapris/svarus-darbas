# Supabase PostgREST 400 dėl `select=`

## Tikslas

Greitai nustatyti ir sutvarkyti atvejį, kai Supabase REST grąžina `400` dėl neteisingo `select=` (neteisingi stulpelių vardai).

## Simptomai

- Frontende arba serveryje matosi `400` atsakas iš `.../rest/v1/<table>?select=...`
- Klaida dažnai pasireiškia tik dalyje aplinkų (schema skiriasi: legacy vs modern).

## Greita diagnostika

- Surasti tikslų užklausos URL (ypač `select=` dalį).
- Patikrinti DB schemą (modern track: `snake_case`, pvz. `client_id`, `owner_id`).

## Veiksmai (mažiausias poveikis)

- Pataisyti `select=` taip, kad nurodytų tik egzistuojančius stulpelius.
- Jei yra schema variantai:
  - aiškiai atskirti „track“ logiką (feature flag / schema detection),
  - vengti „spėliojimo“ — daryti explicit.

## Eskalacija / rollback

- Jei pataisa paveikė daugiau užklausų:
  - grąžinti į paskutinį žalią commit,
  - įdėti minimalų testą arba `/health` diagnostiką, kad regresija būtų matoma.

## Reikia žmogaus (jei taikoma)

- Jei reikia patikrinti production DB schemą ar Supabase logus — reikalinga prieiga prie Supabase projekto (UI/logai).

## Saugiklis (testas/diagnostika)

- Fiksuoti pamoką `.always-on/session-log.md`
- Papildyti `.always-on/known-issues.md` (KI-001)
- Jei įmanoma: testas, kuris aptinka neteisingą select (pvz. schema introspection arba kontraktinis testas per API).

