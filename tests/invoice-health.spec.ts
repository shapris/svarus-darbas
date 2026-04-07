import { expect, test } from '@playwright/test';

/**
 * Auksinis kelias: /health turi būti pasiekiamas per tą patį prievadą kaip CRM (Vite preview proxy → :3001 arba sintetinis atsakas).
 * Užtikrina, kad sąskaitų diagnostika negrįžtų tuščia / be JSON.
 */
test.describe('Sąskaitų API /health', () => {
  test('GET /health — JSON su status, invoiceEmail ir reminders diagnostika', async ({
    request,
  }) => {
    const res = await request.get('/health');
    expect(res.ok(), await res.text()).toBeTruthy();
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toHaveProperty('status');
    expect(body).toHaveProperty('invoiceEmail');
    expect(typeof body.invoiceEmail).toBe('boolean');
    const backendUnavailable = body.backend === 'unavailable';
    if (!backendUnavailable) {
      expect(body).toHaveProperty('reminders');
      const reminders = body.reminders as Record<string, unknown>;
      expect(typeof reminders.cronSecretConfigured).toBe('boolean');
      expect(typeof reminders.workerEnabled).toBe('boolean');
      expect(typeof reminders.workerIntervalMs).toBe('number');
      expect(reminders).toHaveProperty('notificationMetrics');
      const nm = reminders.notificationMetrics as Record<string, unknown>;
      expect(typeof nm.templateVersion).toBe('string');
    }
  });
});
