# Ilgalaikė aplinka (atmintis ir planai)

**Tikslas:** pokalbių esmė, sprendimai ir datuojami įvykiai gyvena **repo viduje**, ne tik Cursor istorijoje. Taip galima autonomiškiau tęsti darbą naujose sesijose ir komandoje.

## Failų žemėlapis

| Failas | Kam skirta | Kada atnaujinti |
|--------|------------|------------------|
| [`work-queue.md`](work-queue.md) | P0/P1 užduočių eilė agentui | Po kiekvieno uždaro punkto (checkmark + žurnalas) |
| [`session-log.md`](session-log.md) | Sesijų santraukos: ką sutarėte, ką padarėte, kas liko | Po reikšmingos sesijos arba bent 1× per savaitę |
| [`decisions.md`](decisions.md) | Stabilūs sprendimai („kodėl taip“) | Kai priimate architektūrinį ar produkto sprendimą |
| [`milestones.md`](milestones.md) | Datos, release, susitikimai, išoriniai terminai | Kai atsiranda data ar įvykis vertas sekti |
| [`improvement-backlog.md`](improvement-backlog.md) | Scout / techninė diagnostika | Automatinis arba `npm run scout:improvements` (jei yra) |
| [`improvement-state.json`](improvement-state.json) | Scout būsena (mašininis) | Automatinis |
| [`worker.log`](worker.log) | Agentų darbo žurnalas (jei naudojamas) | Automatinis |

## Darbo eiga (žmogui ir agentui)

1. **Sesijos pradžioje (šaltas startas):** peržvelgti paskutines 2–3 eilutes [`session-log.md`](session-log.md), atidaryti [`work-queue.md`](work-queue.md), trumpai — [`TASK_MEMORY.md`](../TASK_MEMORY.md).
2. **Sesijos pabaigoje:** į [`session-log.md`](session-log.md) įrašyti 5–10 sakinių (tikslas, kas padaryta, blokatoriai, kitas žingsnis).
3. **Sprendimas „daugiau nebekeisime be priežasties“:** įrašyti į [`decisions.md`](decisions.md).
4. **Be konkrečios užduoties:** vykdyti [`work-queue.md`](work-queue.md) pagal `.cursor/rules/always-on-workflow.mdc` ir `AGENT_PROTOCOL.md`.

## Kas lieka ne faile

- **Cursor Memories / taisyklės** — trumpi priminimai; šaltinis tiesa čia + Git.
- **Slaptažodžiai ir raktai** — tik `.env` ir hostingo panelė; į šiuos failus nerašyti.

Netinka talpinti asmeninius duomenis be būtinybės — laikytis BDAR ir minimalios eksponavimo praktikos.
