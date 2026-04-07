# Pranešimų šablonų versijavimas ir kokybės metrika

## Versija

Transakcinių el. laiškų tekstai gyvena **serveryje** ([`server.cjs`](../server.cjs)). Vieningas identifikatorius:

- **`NOTIFICATION_TEMPLATE_VERSION`** (konstanta `server.cjs`) — keliama, kai keičiasi laiško turinys arba laiško tipų semantika.

Kiekvienas outbound laiškas (Resend) apačioje gali turėti techninę eilutę su šia versija (diagnostikai ir palaikymui; galima išjungti ateityje env vėliava).

## Kas laikoma „kokybe“

- **`notification_events`** lentelėje: `status` (`sent` / `failed` / `pending`), `error`, `sent_at`.
- **`/health`** (kai API pasiekia DB): agregatas **paskutinėms 7 dienoms** — kiek įrašų pagal būsenas (`reminders.notificationMetrics.last7Days`).

## Operacinis naudojimas

1. Prieš keisdami šabloną — padidinkite `NOTIFICATION_TEMPLATE_VERSION` ir užfiksuokite trumpą įrašą į [CHANGELOG.md](../CHANGELOG.md) arba vidinį release pastabą.
2. Po deploy: patikrinkite `/health` ir Supabase `notification_events` paskutines eilutes.
3. Incidentams: [RUNBOOK_INCIDENTS.md](RUNBOOK_INCIDENTS.md) §3–4.
