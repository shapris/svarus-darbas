# Improvement Backlog

Generated: 2026-04-05 18:33:31

## Health Score

- Score: **93 / 100**

## Signals

- **Scope:** only src/**/*.ts(x) and js(x) (excludes *.test.*, *.spec.*, and any src/tests tree).
- TODO/FIXME/HACK count: **0**
- console.error(...) count: **2**
- alert(...) count: **2**
- any usage count: **3**
- NPM audit high/moderate: **0 / 0**
- Largest code files: **src\components\ChatAssistant.tsx (71,2 KB); src\supabase.ts (67,6 KB); src\views\OrdersView.tsx (67,5 KB); src\views\CalendarView.tsx (39,4 KB); src\views\Dashboard.tsx (34,3 KB)**

## Next Actions (Auto-Prioritized)

- Replace remaining alert(...) calls with toast notifications.
- Decrease any usage in top active modules by introducing strict local types.
