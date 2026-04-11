# Operatoriaus ir agento darbo tvarka (be ilgo pokalbio)

**Tikslas:** turėti vieną vietą — kada ką daryti ir ką įklijuoti agentui, kad nereikėtų aiškinti konteksto nuo nulio.

| Nuoroda | Kam |
|--------|-----|
| [work-queue.md](work-queue.md) | P0–P23 punktai, `- [ ]` / `- [x]` |
| [session-log.md](session-log.md) | Kas padaryta, kas liko (po sesijos) |
| [docs/PERIODIC_MAINTENANCE.md](../docs/PERIODIC_MAINTENANCE.md) | `verify`, `npm outdated`, ketvirčio peer patikros |
| [known-issues.md](known-issues.md) | KI-003, KI-004 ir kt. |

---

## Savaitė (≈15 min)

1. Peržvelgti paskutines 2–3 eilutes [session-log.md](session-log.md).
2. Atidaryti [work-queue.md](work-queue.md) — ar yra nepažymėtas `- [ ]` (nuo P0 arba P23).
3. Jei artėja mėnesio pabaiga ir P23.1 dar nepadarytas — žr. mėnesio skyrių.

---

## Mėnuo

1. **`npm outdated`** — minor/patch, tada **`npm run verify`** (žr. [PERIODIC_MAINTENANCE.md](../docs/PERIODIC_MAINTENANCE.md)).
2. **`npm run scout:improvements`** — atnaujina [improvement-backlog.md](improvement-backlog.md); vykdyti [work-queue.md](work-queue.md) **P23.1** ir pažymėti, žurnale įrašyti.
3. Jei score &lt; 95 arba nauji signalai — įrašas į [session-log.md](session-log.md).

---

## Ketvirtis

1. [docs/PERIODIC_MAINTENANCE.md](../docs/PERIODIC_MAINTENANCE.md) — „Kas ketvirtį“: `npm view vite-plugin-pwa@latest peerDependencies`, `eslint-plugin-react-hooks` ir kt.
2. Sulyginti su [known-issues.md](known-issues.md) (KI-003, KI-004); atnaujinti dokumentą arba `session-log`, jei pasikeitė situacija.
3. [work-queue.md](work-queue.md) **P23.2** (ir pageidautina **P23.3** — didžiausio failo įvertinimas).

---

## Įklijuojami šablonai agentui (viena eilutė)

Nukopijuokite į Cursor; taisyklės: [always-on-workflow.mdc](../.cursor/rules/always-on-workflow.mdc).

**Tylus režimas — pirmas nepažymėtas punktas**

```text
Tikslas: Atidaryti .always-on/work-queue.md ir vykdyti pirmą nepažymėtą - [ ] punktą nuo P0; jei P0–P22 uždaryti — P23. Ribos: tik repo ir dokumentai, be produkcijos slaptų. Prioritetas: P1. Vykdyti: taip
```

**Tik P23 (kartotinė priežiūra)**

```text
Tikslas: Vykdyti .always-on/work-queue.md skyrių P23 (pirmas nepažymėtas - [ ] ten); po patikros atnaujinti work-queue žurnalą ir session-log. Ribos: tik repo. Vykdyti: taip
```

**Tik regresija**

```text
Tikslas: npm run verify; jei klaida — sutvarkyti minimaliu diff. Po sėkmės trumpas įrašas į .always-on/session-log.md. Vykdyti: taip
```

**Scout tik**

```text
Tikslas: npm run scout:improvements; peržiūrėti .always-on/improvement-backlog.md; jei score < 95 arba nauji signalai — įrašas į session-log. Vykdyti: taip
```

---

## Šaltinio tiesa

- Eilės kanonas: **[work-queue.md](work-queue.md)**.
- Techninė diagnostika papildomai: **improvement-backlog** (po scout).
