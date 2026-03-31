# Improvement Backlog

Generated: 2026-03-31 09:43:37

## Health Score

- Score: **53 / 100**

## Signals

- TODO/FIXME/HACK count: **0**
- console.error(...) count: **60**
- alert(...) count: **19**
- any usage count: **106**
- NPM audit high/moderate: **4 / 0**
- Largest code files: **src\components\ChatAssistant.tsx (61,1 KB); src\supabase.ts (52 KB); src\views\CalendarView.tsx (33,5 KB); src\views\Dashboard.tsx (31,5 KB); src\views\OrdersView.tsx (31 KB)**

## Next Actions (Auto-Prioritized)

- Replace remaining alert(...) calls with toast notifications.
- Reduce noisy console.error(...) paths in runtime flows and keep only actionable logs.
- Decrease any usage in top active modules by introducing strict local types.
- Review dependency vulnerabilities and patch non-breaking updates.
