import { expect, test } from '@playwright/test';

/**
 * Incident-to-test šablonas.
 *
 * Naudojimas:
 * 1) Nukopijuok failą į tests/incident-YYYYMMDD-aprasymas.spec.ts
 * 2) Pakeisk endpoint'ą, užklausą ir asserts pagal konkretų incidentą
 * 3) Paleisk testą ir užfiksuok session-log
 */

const INCIDENT_ID = 'INCIDENT-YYYYMMDD-XXX';

test.describe(`Incident contract: ${INCIDENT_ID}`, () => {
  test('endpoint grąžina stabilų kontraktą', async ({ request }) => {
    // GIVEN: stabilus endpoint'as /health arba konkretus API kelias
    // WHEN: atliekame užklausą, kuri anksčiau lūždavo
    const response = await request.get('/health');

    // THEN: kontraktas yra stabilus ir turi būtinus laukus
    expect(response.ok(), `${INCIDENT_ID}: endpoint should respond with 2xx`).toBeTruthy();

    const body = (await response.json()) as Record<string, unknown>;
    expect(body, `${INCIDENT_ID}: missing status`).toHaveProperty('status');
  });
});
