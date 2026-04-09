/**
 * Atlaisvina dev / E2E prievadus (Windows + Linux/macOS), kad keli Playwright paleidimai iš eilės
 * neliktų „pakibusio“ vite preview (4173) ir nestrigtų libuv (ypač Windows).
 */
import killPort from 'kill-port';

const ports = [4173, 3001, 5173];

await Promise.all(
  ports.map((p) =>
    killPort(p).catch(() => {
      /* jau laisvas arba ne mūsų procesas */
    })
  )
);
