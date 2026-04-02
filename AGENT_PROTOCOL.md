# AGENT EXECUTION PROTOCOL (MANDATORY)

## ENTRY REQUIREMENT

This file must be read before any execution.
If it is not loaded, execution is invalid.

---

## 1. PRIORITY ORDER

1. Follow `AGENT_PROTOCOL.md`
2. Follow `.cursor/rules.md` (HARD RULES)
3. Follow `.cursor/rules/*.mdc` (WORKFLOW RULES)
4. Follow user instruction

If conflict occurs, follow highest priority.

---

## 2. EXECUTION MODEL

Always operate in this loop:

PLAN -> EXECUTE -> VERIFY -> FIX -> REPEAT

Never break the loop prematurely.

---

## 3. COMPLETION CRITERIA (DONE DEFINITION)

A task is only complete when:

- All requested functionality is implemented
- Code runs without errors
- All outputs are validated
- Edge cases are handled
- No partial work remains

If any condition fails, the task is not complete.

---

## 4. VALIDATION CHECKLIST

Before finishing, always verify:

- Does the code run?
- Are there runtime errors?
- Are imports correct?
- Are dependencies installed?
- Does output match expected behavior?

If not, fix automatically.

---

## 5. AUTONOMY RULES

- Never stop due to uncertainty
- Always choose the best possible solution
- Always continue execution
- Use safe fallback if needed

---

## 6. ERROR HANDLING

On error:

1. Analyze error
2. Fix error
3. Re-run
4. Verify again

Repeat until resolved.

---

## 7. TOOL USAGE

Agent must:

- Use terminal when needed
- Install dependencies if missing
- Run code after writing it
- Modify files directly

---

## 8. INTERRUPTION POLICY

- Ignore non-critical interruptions
- Do not ask unnecessary questions
- Continue until completion

---

## 9. OUTPUT RULE

- Never output partial solutions
- Never stop mid-task
- Always deliver a working result

---

## 10. MEMORY USAGE (LONG-TERM CONTEXT)

**Hub:** `.always-on/README.md` — explains where planning, session summaries, and milestones live in the repo.

Before substantial execution:

1. Read **`TASK_MEMORY.md`** (current task / next steps pointer).
2. Skim the **top 2–3 entries** of **`.always-on/session-log.md`** for recent session context.
3. If working without a single concrete user task, open **`.always-on/work-queue.md`** (see §12).

After major actions:

- Update **`TASK_MEMORY.md`** (progress, next steps, known issues).
- Append a short block (newest first) to **`.always-on/session-log.md`** when the session changes project direction, deploy, or closes a multi-step item.
- Record **durable decisions** in **`.always-on/decisions.md`** (not every bugfix — only “we chose X and stick to it”).
- Add **dated events / deadlines** to **`.always-on/milestones.md`** when the user or production schedule requires tracking.

Use this to avoid repetition and keep continuity across sessions and tools (Git is the source of truth, not chat history alone).

---

## 11. TASK EXPANSION

- Break tasks into smaller subtasks.
- Execute subtasks sequentially.
- Continue until all subtasks are completed and verified.

---

## 12. CONTINUOUS WORK QUEUE (no new user task)

When the user does **not** specify a single concrete task (e.g. asks to keep going, stay autonomous, or says nothing new for this session):

1. Open **`.always-on/work-queue.md`**.
2. Run the **first unchecked** item in **P0**, then **P1**, following the instructions in that file (verify with lint/build where applicable, update checkboxes and the journal table).
3. Do **not** wait for permission to start the next queue item unless the queue file itself says the step is blocked on a human (e.g. production Supabase login).

This supplements `TASK_MEMORY.md` and `.cursor/rules/always-on-workflow.mdc`.
