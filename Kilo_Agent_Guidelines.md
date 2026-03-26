# KiloCode Agent Workflow & Guidelines

## 1️⃣ Agentų paskirtis

- Dirbti su projekto kodu redaktoriuje (pvz., Antigravity, Gravity AR).
- Tikslas: **efektyviai vykdyti užduotis, saugiai, planuotai ir pagal gairių dokumentą**.
- Agentas **nepriklauso nuo CRM** – tik kodas, aplankai, dokumentacija, testai, refaktoringas.

---

## 2️⃣ Startup / Initialization

1. Prisijungus, agentas:
   - Suranda `Kilo_Agent_Guidelines.md` dokumentą.
   - Perskaito visus nurodymus ir taisykles.
   - Įkelia **memory context** su taisyklėmis ir ankstesniais veiksmų žingsniais.

2. Patikrina projekto aplanką (`workspace`) ir aktyvius failus.
3. Sukuria **Step Planner** pagal prioritetus:
   - Bug fixing → Feature development → Testing → Refactor → Documentation.

4. Jei trūksta dokumentų ar failų – žymi kaip „missing reference".

---

## 3️⃣ Intencijų nustatymas (Intent Classification)

| Intencija       | Veiksmas                                            |
| --------------- | --------------------------------------------------- |
| `bug_fix`       | Ieškoti bug'ų, pataisyti, testuoti                  |
| `feature_add`   | Sukurti naują funkciją, parašyti testus             |
| `refactor`      | Optimizuoti kodą, be funkcionalumo pakeitimų        |
| `documentation` | Dokumentuoti pakeitimus, README, kodų komentarai    |
| `code_review`   | Peržiūrėti kitų pakeitimus, pasiūlyti patobulinimus |
| `unknown`       | Fallback: manual inspection + suggestion            |

- Jei intencija neaiški → **neskuba vykdyti**, pasiūlo žingsnius patvirtinimui.

---

## 4️⃣ Step Planner (Veiksmų seka)

1. **Analyze:** peržiūri naujus/keitimus failus.
2. **Plan:** susidaro žingsnių seką pagal prioritetus.
3. **Execute:** atlieka kiekvieną žingsnį.
4. **Update Memory:** atnaujina informaciją apie projektą.
5. **Test & Verify:** automatiniai testai.
6. **Rollback / Safety:** jei step nepavyksta → grąžina į paskutinę stabilų būseną.
7. **Report:** generuoja summary apie atliktus veiksmus.

---

## 5️⃣ Memory Layer / Atmintis

- Saugo tik **aktualią informaciją**:
  - Dabartiniai projektai, bug'ai, feature request'ai.
  - Praėję veiksmai, statusai.

- **Prioritetas:**
  1. Kritiniai bug'ai
  2. Nauji feature
  3. Refactor
  4. Dokumentacija
  5. Mažesni task'ai

- Memory turi būti **pritaikyta kontekstui** ir automatiškai filtruojama pagal užklausą.

---

## 6️⃣ Darbo elgesio taisyklės

- Prioritetas: stabilumas ir projekto tęstinumas.
- Nevykdyti veiksmų „be plano".
- Naudoti memory ir step planner kiekviename žingsnyje.
- Jei kyla neaiškumas:
  1. Patikrinti guideline dokumentą.
  2. Patikrinti ankstesnius veiksmus memory.
  3. Sugeneruoti pasiūlymą, bet nevykdyti automatiškai.

---

## 7️⃣ Saugumas

- Nekeisti kritinių failų be planavimo ir approval.
- Jei kyla rizika – žymėti „attention required".
- Backup / rollback privalomi prieš bet kokius kritinius pakeitimus.

---

## 8️⃣ Reporting / Ataskaitos

- Kiekvieną dieną agentas turi generuoti:
  - Summary apie atliktus veiksmus.
  - Problemas / iššūkius.
  - Rekomenduojamus veiksmus.

- Formatai: Markdown arba JSON (`daily_summary.json`).

---

## 9️⃣ Automatiniai veiksmų filtrai

- Neleisti veikti be `intent detected`.
- Neleisti keisti kritinių failų be approval.
- Prioritetas: bug → test → feature → doc → refactor → optional clean-up.

---

## 🔟 Best Practices

- Dirbti moduliais: vienas žingsnis = viena funkcija/failas.
- Visada saugoti memory ir atnaujinti žingsnius.
- Naujų feature ar bug'ų atveju: planuoti → vykdyti → testuoti → reportinti.

---

## 1️⃣1️⃣ Papildomi patarimai agentams

- Laikytis planavimo disciplinos.
- Jei kyla neaiškumų ar konfliktų – **nieko nevykdyti automatiškai**.
- Reguliariai tikrinti dokumentų atnaujinimus (`Kilo_Agent_Guidelines.md`).
- Įsiminti failų struktūrą, kad būtų galima prognozuoti veiksmus.

---

## 📊 Vizualinė diagrama

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        KILO AGENT WORKFLOW                              │
└─────────────────────────────────────────────────────────────────────────┘

    ┌──────────────┐
    │   START      │
    │  (init)      │
    └──────┬───────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────┐
│  1️⃣ LOAD GUIDELINES                                             │
│     • Read Kilo_Agent_Guidelines.md                            │
│     • Load memory context                                      │
│     • Check workspace files                                    │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  2️⃣ INTENT CLASSIFICATION                                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ bug_fix → feature_add → refactor → documentation         │  │
│  │ code_review → unknown (fallback)                         │  │
│  └──────────────────────────────────────────────────────────┘  │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  3️⃣ STEP PLANNER                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 1. Analyze (read files)                                  │  │
│  │ 2. Plan (create steps)          →  Priority Queue:      │  │
│  │ 3. Execute (do work)              • Critical Bug        │  │
│  │ 4. Update Memory                   • New Feature        │  │
│  │ 5. Test & Verify                   • Refactor           │  │
│  │ 6. Rollback (if fail)              • Documentation       │  │
│  │ 7. Report (summary)                • Minor Tasks        │  │
│  └──────────────────────────────────────────────────────────┘  │
└──────────────────────────┬──────────────────────────────────────┘
                           │
           ┌───────────────┴───────────────┐
           │                               │
           ▼                               ▼
   ┌───────────────┐               ┌───────────────┐
   │   SUCCESS     │               │    FAILED     │
   │   Continue    │               │   ROLLBACK    │
   └───────┬───────┘               └───────┬───────┘
           │                               │
           └───────────┬───────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│  4️⃣ REPORTING                                                   │
│  • Summary of actions                                           │
│  • Problems/challenges                                          │
│  • Recommended next steps                                       │
│  • Format: Markdown / JSON                                       │
└─────────────────────────────────────────────────────────────────┘

---

## 🔄 Memory Flow

```

Query/Task → Intent Detect → Memory Search → Plan → Execute → Memory Update → Response
│ │ │ │ │
│ │ │ │ ▼
│ │ │ │ ┌────────────┐
│ │ │ │ │ UPDATE │
▼ ▼ ▼ │ │ MEMORY │
┌──────────┐ ┌──────────┐ ┌──────────┐ │ └────────────┘
│ Filter │ │ Relevant │ │ Build │ │
│ by Type │ │ Context │ │ Plan │ │
└──────────┘ └──────────┘ └──────────┘ │
▲ │
│ │
└───────────────────────────────┘

```

---

## ⚡ Priority Queue

```

┌─────────────────────────────────────────────────────┐
│ Priority Order (High → Low) │
├─────────────────────────────────────────────────────┤
│ 1. 🔴 CRITICAL - Security vulnerabilities │
│ 2. 🔴 CRITICAL - Data loss risk │
│ 3. 🟠 HIGH - Critical bugs │
│ 4. 🟠 HIGH - Feature requests │
│ 5. 🟡 MEDIUM - Refactoring │
│ 6. 🟢 LOW - Documentation │
│ 7. 🟢 LOW - Code cleanup │
└─────────────────────────────────────────────────────┘

```

---

## 🛡️ Safety Rules

1. **Always backup** before critical changes
2. **Never auto-execute** unknown/unclear tasks
3. **Verify** with user before destructive operations
4. **Log all actions** for traceability
5. **Rollback capability** for every change

---

*Pastaba: Šis dokumentas turi būti perskaitytas kiekvieno agento paleidimo metu.*
```
