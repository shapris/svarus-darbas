# TASK MEMORY

**Ilgalaikė atmintis ir planai:** žr. **`.always-on/README.md`** (`session-log.md`, `decisions.md`, `milestones.md`, `work-queue.md`).

## CURRENT TASK
- Goal:
- Status:
- Progress:

## COMPLETED STEPS
- [x] Created `AGENT_PROTOCOL.md` + bootstrap rules in `README.md`
- [x] Added hard rules in `.cursor/rules.md` and strengthened `.cursor/rules/always-on-workflow.mdc`

## NEXT STEPS (eilė)
- **Pagrindinis šaltinis:** `.always-on/work-queue.md` — P0 → P1, atnaujinamas po kiekvieno uždaro punkto.
- Šiame faile laikykitės tik trumpų nuorodų; detalės ir checkbox’ai — `work-queue.md`.

## KNOWN ISSUES
- Dashboard “stats cards” clickability fix needs deployment verification on Vercel
- Large bundle chunk warning (~700kB) is informational (not a build failure)

## DECISIONS
- Detalės ir istoriniai įrašai: **`.always-on/decisions.md`**
- Trumpai: Supabase tik per env; vengti `aiService` re-export ciklų (Rollup)
