# SMS priminimų šablonai (LT) — gairės

Šis dokumentas aprašo, kaip rašyti SMS priminimus CRM kontekste. **Tai nėra teisinė konsultacija** — prieš masinį siuntimą patikrinkite vietinius reikalavimus (rinkodara, sutikimai, „neskambinti“ sąrašai ir pan.).

## Kur redaguoti šabloną

- CRM: **Nustatymai** → skiltis su kainomis → laukas **„SMS Priminimo Šablonas“** (`settings.smsTemplate`).

## Palaikomi kintamieji (placeholderiai)

Programa keičia šiuos fragmentus į faktinius duomenis (žr. `DEFAULT_SETTINGS.smsTemplate` ir `SettingsView` žymes):

| Placeholder  | Reikšmė (pavyzdys)        |
|-------------|----------------------------|
| `{vardas}`  | Kliento vardas             |
| `{data}`    | Užsakymo data              |
| `{laikas}`  | Užsakymo laikas            |
| `{kaina}`   | Kaina (tekstas su € žyme)  |

**Svarbu:** placeholderių vardus rašykite tiksliai — su riestiniais skliaustais, be tarpų (`{vardas}`, ne `{ vardas }`).

## Rekomenduojama struktūra (trumpa žinutė)

1. **Sveikinimas** + kliento vardas (`{vardas}`).
2. **Kas ir kada** — data ir laikas (`{data}`, `{laikas}`).
3. **Kaina** (`{kaina}`) — jei nenorite rodyti kainos SMS, placeholderį išimkite ir suformuluokite be jo.
4. **Veiksmas** — pvz. „Jei reikia perkelti laiką, atsakykite į šį numerį.“

## Pavyzdinis šablonas (numatytasis kode)

```
Sveiki {vardas}, primename apie langų valymą {data} {laikas}. Kaina: {kaina}. Iki pasimatymo!
```

## Papildomi patarimai

- Laikykitės **trumpo** teksto (dažnai ~160 simbolių viename SMS segmente priklausomai nuo koduotės).
- Venkite perteklinės skyrybos simboliais, kurie gali klaidinti senesnius telefonus.
- Jei naudojate išorinį SMS tiekėją, jų portale gali būti **papildomų taisyklių** ir draudžiamų frazių.

## Susijusi logika kode

- Priminimo peržiūra per asistento įrankį: `generate_reminder_message` (`src/components/chatAssistant/toolHandler.ts`) naudoja tą patį `settings.smsTemplate` su `{vardas}`, `{data}`, `{laikas}`, `{kaina}`.
