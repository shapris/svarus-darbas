# Atsarginės kopijos ir operacijos (Supabase)

## Kas valdo backup

- **Supabase Cloud:** atsarginės kopijos ir (pasirinktinai) **Point-in-Time Recovery (PITR)** valdomi per Supabase projekto planą ir dashboard.
- **Atsakingas:** projekto savininkas / organizacija, kurios billing prijungtas prie Supabase.

## Oficialūs šaltiniai

- [Supabase Backups](https://supabase.com/docs/guides/platform/backups) — automatinių backupų aprašymas ir planų skirtumai.
- [Database — restoring](https://supabase.com/docs/guides/platform/database-size) — susijusi operacinė dokumentacija (dydis, priežiūra).

## Praktika šiam repo

- Prieš didelius SQL pakeitimus: eksportas arba Supabase backup langas patvirtintas.
- Po incidento: įrašas į [`.always-on/session-log.md`](../.always-on/session-log.md) ir, jei reikia, naujas punktas [darbotvarkėje](../.always-on/work-queue.md).
