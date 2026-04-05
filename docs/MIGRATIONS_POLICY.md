# Migracijų politika (Supabase)

## Kada naudoti `supabase/migrations/`

- **Versijuojami, kartojami pakeitimai** (naujos lentelės, RLS politikos, indeksai, funkcijos), kuriuos norite atkartoti naujuose aplinkose.
- Komanda arba CI naudoja CLI (`supabase db push` / link) — tada migracijos yra **source of truth**.

## Kada naudoti SQL Editor (vienkartiniai failai repo šaknyje)

- **Didelės pradinės schemos** arba „vieno lango“ kanonas: pvz. [`supabase/production_owner_id_schema.sql`](../supabase/production_owner_id_schema.sql), [`supabase/public_booking_rpcs.sql`](../supabase/public_booking_rpcs.sql).
- Vykdyti **vieną kartą** kiekvienoje aplinkoje arba po aiškaus CHECKLIST; dokumentuoti kuris failas taikytas (žr. [`PRODUCTION_CHECKLIST.md`](PRODUCTION_CHECKLIST.md)).

## Breaking pakeitimai

1. Pridėti naują stulpelį su numatytąja reikšme prieš senų klientų atnaujinimą.
2. Stulpelio pervadinimą daryti dviem etapais: naujas stulpelis → backfill → seno naikinimas (arba view).
3. **Nemaišyti** Track A (`owner_id` + snake_case) ir Track B (legacy `uid` + camelCase) tame pačiame projekte.

Daugiau: [`DEPLOY.md`](DEPLOY.md), [`DATABASE_SETUP.md`](../DATABASE_SETUP.md).
