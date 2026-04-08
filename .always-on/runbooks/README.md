# Runbooks (operaciniai scenarijai)

Šiame kataloge laikomi trumpi „jei X — daryk Y“ veiksmai, kad incidentai būtų sprendžiami greitai ir nuosekliai.

## Principai

- Runbook turi būti vykdomas **be spėliojimo**.
- Jei reikia žmogaus (pvz., prisijungti į Supabase/Render), tai aiškiai pažymėta skyriuje „Reikia žmogaus“.
- Po incidento: atnaujinti `.always-on/session-log.md`, `.always-on/known-issues.md` ir (jei verta) pridėti „saugiklį“ testu/diagnostika.

## Šablonas

```md
## Tikslas
## Simptomai
## Greita diagnostika
## Veiksmai (mažiausias poveikis)
## Eskalacija / rollback
## Reikia žmogaus (jei taikoma)
## Saugiklis (testas/diagnostika)
```

