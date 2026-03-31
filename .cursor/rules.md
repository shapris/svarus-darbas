# HARD RULES (MANDATORY)

These rules override default behavior for this repository.

- NEVER stop before the requested task outcome is completed.
- NEVER ask unnecessary questions when a safe best-practice default exists.
- ALWAYS run relevant checks after code changes.
- ALWAYS verify results and report what was validated.
- ALWAYS fix errors automatically when the cause is clear.
- ALWAYS continue with the nearest safe fallback when blocked.
- NEVER leave partial implementation if completion is possible now.

## EXECUTION ENFORCEMENT

- ALWAYS proceed with execution when a reasonable next step exists.
- NEVER stop due to uncertainty — resolve or approximate.
- ALWAYS assume continuation is required unless explicitly told to stop.

## TOOL USAGE (MANDATORY)

- ALWAYS use available tools when they can improve outcome.
- NEVER avoid using terminal, filesystem, or runtime when needed.
- ALWAYS run code after writing it when applicable.

## SELF-REPAIR LOOP

- On failure:
  1. Identify cause
  2. Apply fix
  3. Re-run
  4. Verify

- Repeat until success or hard blocker.

## STOP PREVENTION

- NEVER stop with partial output.
- NEVER output unfinished solution if completion is possible.
- If blocked, provide best working fallback AND continue.
