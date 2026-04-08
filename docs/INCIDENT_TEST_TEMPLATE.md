# Incident -> Test (5 min) šablonas

Tikslas: po naujo incidento greitai pridėti regresinį testą, kad klaida nepasikartotų.

## 1) Pasirink šabloną

- API/kontraktui: kopijuok `tests/templates/incident-contract.template.ts`.
- UI srautui: kopijuok artimiausią Playwright testą iš `tests/*.spec.ts`.

## 2) Sukurk testą (vardinimas)

- Kelias: `tests/incident-<YYYYMMDD>-<trumpas-pavadinimas>.spec.ts`
- Pvz.: `tests/incident-20260408-health-reminders.spec.ts`

## 3) Užpildyk 4 laukus

1. `INCIDENT_ID` (pvz. data + ticket)
2. `Given/When/Then` scenarijų komentaruose
3. Tikslų assertion, kuris reprodukuoja bug'ą
4. Klaidos tekstą `expect(..., 'žinutė')`, kad CI būtų aiškus

## 4) Paleisk minimalią patikrą

- API incidentui: `npm run test:invoice` arba konkretų failą su Playwright.
- UI incidentui: `npm run test:smoke` arba konkretų `.spec.ts`.
- Bendrai prieš push: `npm test`.

## 5) Užfiksuok

- Įrašyk į `.always-on/session-log.md`:
  - kas sugedo,
  - koks testas pridėtas,
  - kokia komanda patikrinta.

## Mini checklist

- [ ] Testas reprodukuoja ankstesnį bug'ą
- [ ] Testas krenta prieš fix ir praeina po fix
- [ ] Testo pavadinimas aiškiai nusako incidentą
- [ ] Patikra paleista lokaliai
