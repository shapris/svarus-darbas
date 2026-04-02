# Improvement Backlog

Generated: 2026-04-02 18:00:37

## Health Score

- Score: **68 / 100**

## Signals

- TODO/FIXME/HACK count: **0**
- console.error(...) count: **63**
- alert(...) count: **2**
- any usage count: **110**
- NPM audit high/moderate: **1 / 0**
- Largest code files: **src\supabase.ts (65 KB); src\components\ChatAssistant.tsx (64,9 KB); src\views\OrdersView.tsx (64 KB); src\views\CalendarView.tsx (35,7 KB); src\views\Dashboard.tsx (33,9 KB)**

## Next Actions (Auto-Prioritized)

- Replace remaining alert(...) calls with toast notifications.
- Reduce noisy console.error(...) paths in runtime flows and keep only actionable logs.
- Decrease any usage in top active modules by introducing strict local types.
- Review dependency vulnerabilities and patch non-breaking updates.
