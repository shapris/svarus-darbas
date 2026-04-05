# Improvement Backlog

Generated: 2026-04-05 17:54:28

## Health Score

- Score: **85 / 100**

## Signals

- TODO/FIXME/HACK count: **0**
- console.error(...) count: **32**
- alert(...) count: **2**
- any usage count: **3**
- NPM audit high/moderate: **0 / 0**
- Largest code files: **src\components\ChatAssistant.tsx (70,9 KB); src\supabase.ts (68,2 KB); src\views\OrdersView.tsx (67,6 KB); src\views\CalendarView.tsx (39,3 KB); src\views\Dashboard.tsx (37,9 KB)**

## Next Actions (Auto-Prioritized)

- Replace remaining alert(...) calls with toast notifications.
- Reduce noisy console.error(...) paths in runtime flows and keep only actionable logs.
- Decrease any usage in top active modules by introducing strict local types.
