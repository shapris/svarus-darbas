# Stripe: testavimas

## Automatiniai testai (repo)

- **Nėra** pilno end-to-end Stripe Checkout srauto su tikru tinklu CI — per daug priklausomybių nuo raktų, webhook ir Render URL.

## Rankinė QA (rekomenduojama prieš mokamus paleidimus)

1. Stripe **test mode** raktai Render (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`) ir Vercel (`VITE_STRIPE_PUBLISHABLE_KEY`).
2. Webhook į `https://<api>/webhook` su įvykiais `payment_intent.succeeded`, `payment_intent.payment_failed` (žr. [`server.cjs`](../server.cjs)).
3. Patikrinti, kad **`SUPABASE_SERVICE_ROLE_KEY`** nustatytas — kitaip mokėjimų būsena gali likti tik atmintyje.

## Dokumentacija

- [`PRODUCTION_CHECKLIST.md`](PRODUCTION_CHECKLIST.md) — Stripe webhook ir env kryžminė patikra.
- [`env-matrix.md`](env-matrix.md) — visi susiję kintamieji.
