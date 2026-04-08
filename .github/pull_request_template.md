## Scope

- [ ] Stabilumas / incidentų prevencija
- [ ] Nauja funkcija
- [ ] Refaktorius / tech debt
- [ ] Dokumentacija
- [ ] CI / DevOps

## Summary

-

## Rizika

- **Kas gali lūžti**:
- **Poveikis**: P0 | P1 | P2 | P3

## Test plan (privaloma)

- [ ] `npm run lint`
- [ ] `npm test`
- [ ] (jei liečia UI srautus) `npm run test:smoke`
- [ ] (jei liečia konsolę/UX) `npm run test:console`
- [ ] (jei liečia sąskaitas ar `/health`) `npm run test:invoice`
- [ ] (prieš release / dideliems pokyčiams) `npm run verify`

## Rollback plan

- [ ] Revert vienas commit / PR
- [ ] Jei reikia, išjungti per feature flag / nustatymą (aprašyti)

## Incident → testas / atmintis

- [ ] Jei šis PR sprendžia incidentą: papildyta `.always-on/known-issues.md`
- [ ] Jei reikia operacinio scenarijaus: pridėtas `.always-on/runbooks/*`
- [ ] Pridėtas minimalus testas arba `check:*` skriptas, kad regresija nebegrįžtų
