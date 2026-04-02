# Sprendimų žurnalas (ADR light)

Įrašykite tik **stambius** ar **ilgai galiojančius** sprendimus. Formatas: data, kontekstas, sprendimas, pasekmės.

---

## 2026-03-31 — Supabase raktai ir konfigūracija

- **Sprendimas:** neplėšti Supabase URL / anon rakto į šaltinio kodą; naudoti tik `VITE_*` / env.
- **Pasekmės:** deploy ir lokalu vienoda praktika; raktai lieka hostinge.

## 2026-03-31 — Rollup / AI servisų ciklai

- **Sprendimas:** vengti re-export ciklų `aiService`, kad nekiltų Rollup chunk priklausomybės problemos.
- **Pasekmės:** stabilesnis build.

## 2026-04-02 — Ilgalaikė atmintis repo viduje

- **Sprendimas:** planai, sesijų santraukos ir datos saugomi `.always-on/` failuose versijuojant su Git, o ne tik Cursor pokalbio istorijoje.
- **Pasekmės:** naujos sesijos ir komanda gali tęsti tą patį kontekstą be rankinio perkėlimo.

---

<!-- Šablonas:

## YYYY-MM-DD — pavadinimas

- **Kontekstas:**
- **Sprendimas:**
- **Pasekmės / alternatyvos atmestos:**

-->
