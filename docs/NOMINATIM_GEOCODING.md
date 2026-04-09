# OpenStreetMap Nominatim (geokodavimas asistente)

CRM asistento įrankis `geocode_address` kviečia viešą **Nominatim** API (`https://nominatim.openstreetmap.org/search`).

## Kodėl reikalingas `User-Agent`

[OpenStreetMap naudojimo politika](https://operations.osmfoundation.org/policies/nominatim/) reikalauja, kad automatizuotos užklausos identifikuotų programą (ne bendrinį naršyklės agentą). Projekte naudojamas antraštė:

`User-Agent: SvarusDarbas-CRM/1.0 (+https://github.com/shapris/svarus-darbas)`

Implementacija: `src/components/chatAssistant/toolHandler.ts` (`geocode_address`).

## Rekomendacijos

- **Intensyvus naudojimas:** jei geokodavimo bus daug (masinis importas, foninės užduotys), verta savo geokodavimo instancą arba mokamą tiekėją — Nominatim viešas endpoint turi naudojimo ribas.
- **Duomenų tikslumas:** rezultatas priklauso nuo įvesties formuluotės; kritiniams atvejams patikrinkite adresą žemėlapyje.

## Susiję failai

- `src/components/chatAssistant/toolHandler.ts` — `fetch` su antraštėmis
- `src/services/toolDefinitions.ts` — `geocode_address` aprašas modeliui
