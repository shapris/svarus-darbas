# Bundle analizė

## Vienkartinė ataskaita

```bash
npm run build:analyze
```

Po build atverkite **`dist/stats.html`** naršyklėje (Treemap / sunburst priklausomai nuo `rollup-plugin-visualizer` versijos).

## Ką žiūrėti

- Didžiausius `vendor-*` ir `app-*` gabalus — ar galima dar `import()` lazy į antrines skiltis.
- Pagrindinis `vendor` chunk vis dar didelis dėl React transityvumo — žr. komentarą `vite.config.ts` (`chunkSizeWarningLimit`).

Įrašykite svarbiausius radinius į [`.always-on/session-log.md`](../.always-on/session-log.md) po profiliavimo sesijos.
