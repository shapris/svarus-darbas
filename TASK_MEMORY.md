# TASK MEMORY

## CURRENT TASK
- Goal:
- Status:
- Progress:

## COMPLETED STEPS
- [x] Created `AGENT_PROTOCOL.md` + bootstrap rules in `README.md`
- [x] Added hard rules in `.cursor/rules.md` and strengthened `.cursor/rules/always-on-workflow.mdc`

## NEXT STEPS
- [ ] Populate current project goals (Vercel env vars, Supabase setup, key rotation, smoke tests)
- [ ] Run an end-to-end smoke test in production and fix any runtime errors

## KNOWN ISSUES
- Dashboard “stats cards” clickability fix needs deployment verification on Vercel
- Large bundle chunk warning (~700kB) is informational (not a build failure)

## DECISIONS
- Removed hardcoded Supabase URL/anon key from source; use env only
- Avoid re-export cycles in `aiService` to prevent Rollup chunk circular dependencies
