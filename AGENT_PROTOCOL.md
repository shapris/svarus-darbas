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

## 10. MEMORY USAGE

- Always read `TASK_MEMORY.md` before execution.
- Always update `TASK_MEMORY.md` after major actions (progress, next steps, known issues, decisions).
- Use it to avoid repetition and keep long-horizon continuity across sessions.

---

## 11. TASK EXPANSION

- Break tasks into smaller subtasks.
- Execute subtasks sequentially.
- Continue until all subtasks are completed and verified.
