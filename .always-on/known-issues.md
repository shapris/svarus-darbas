# Žinomos problemos / rizikos (kanoninis registras)

Tikslas: turėti vieną vietą, kur aiškiai matosi **kas žinoma**, **kaip atkartoti**, **koks workaround**, ir **koks testas/diagnostika saugo nuo regresijos**.

## Šablonas

```md
## <ID> — <Trumpas pavadinimas>

- Būsena: open | mitigated | fixed | wontfix
- Poveikis: P0 | P1 | P2 | P3
- Simptomai:
- Priežastis:
- Atkūrimas:
- Sprendimas / mitigacija:
- Saugiklis (testas/diagnostika):
- Pastabos:
```

---

## KI-001 — PostgREST 400 dėl neteisingo `select=` (orders schema)

- Būsena: mitigated
- Poveikis: P0 (gali sukelti serverio grandinines klaidas, iki 502 hostinge)
- Simptomai:
  - Supabase REST grąžina `400` ant `.../rest/v1/orders?...&select=...`
  - Hostingas (pvz., Render) kartais mato `502` srautuose, kur serveris kviečia Supabase su neteisingu `select`.
- Priežastis:
  - `select=` užklausoje nurodyti stulpeliai, kurių schemoje nėra (camelCase vs `snake_case`, pvz. `clientId` vietoje `client_id`).
- Atkūrimas:
  - Pabandyk užklausti `orders` per REST su neegzistuojančiu stulpeliu `select` dalyje.
- Sprendimas / mitigacija:
  - Serverio pusėje naudoti tik realius stulpelius (`id,client_id,owner_id,...`) ir vengti spėliojimo.
- Saugiklis (testas/diagnostika):
  - Repo „atmintis“: `.always-on/session-log.md` pamoka apie `select`.
  - (Papildomai) `/health` diagnostika padeda identifikuoti backend pasiekiamumą.
- Pastabos:
  - Jei DB schema realiai skiriasi (legacy), reikia aiškiai įvardinti track ir atskirti logiką.

---

## KI-002 — E2E preview be `server.cjs`: Vite proxy triukšmas į :3001

- Būsena: mitigated
- Poveikis: P3 (triukšmas testų output, klaidina)
- Simptomai:
  - Playwright testuose matosi `[vite] http proxy error: /health` ir `ECONNREFUSED 127.0.0.1:3001`, nors testas praeina.
- Priežastis:
  - Preview serveris bando proxy’inti `/health` į :3001, kai `server.cjs` sąmoningai nepaleistas.
- Sprendimas / mitigacija:
  - Įjungtas tylus loggeris per `VITE_SILENT_EXPECTED_PROXY_ERRORS=true` E2E metu.
- Saugiklis (testas/diagnostika):
  - `npm run test:invoice` praeina be klaidinančio proxy log’o.

