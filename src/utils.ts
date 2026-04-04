/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AppSettings, Order, Client, INVOICE_API_STORAGE_KEY } from './types';
import { usesLocalStorageBackend, supabase } from './supabase';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import dejaVuSansUrl from 'dejavu-fonts-ttf/ttf/DejaVuSans.ttf?url';
import dejaVuSansBoldUrl from 'dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf?url';

/** Įmonės rekvizitai PDF sąskaitai (galite vėliau perkelti į Nustatymus). */
const INVOICE_VENDOR = {
  name: 'Švarus Darbas MB',
  regCode: '305678912',
  vatCode: 'LT100012345612',
  address: 'Vilniaus g. 10, Vilnius',
  phone: '+370 600 00000',
  email: 'info@svarusdarbas.lt',
  bank: 'Swedbank AB',
  iban: 'LT12 7300 0000 0000 0000',
} as const;

const PDF_FONT = 'DejaVuSans';

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunk, bytes.length)));
  }
  return btoa(binary);
}

type CachedDejaVu = { normalB64: string; boldB64: string };

let pdfFontDataPromise: Promise<CachedDejaVu> | null = null;

/**
 * jsPDF 4: virtualus failų rinkinys (VFS) ir addFont yra ant KONKRETUS dokumento.
 * Cache'iname tik base64 turinį; kiekvienam naujam doc — addFileToVFS + addFont.
 */
function loadDejaVuFontData(): Promise<CachedDejaVu> {
  if (!pdfFontDataPromise) {
    pdfFontDataPromise = (async () => {
      const [normalBuf, boldBuf] = await Promise.all([
        fetch(dejaVuSansUrl).then((r) => {
          if (!r.ok) throw new Error('DejaVuSans.ttf');
          return r.arrayBuffer();
        }),
        fetch(dejaVuSansBoldUrl).then((r) => {
          if (!r.ok) throw new Error('DejaVuSans-Bold.ttf');
          return r.arrayBuffer();
        }),
      ]);
      return {
        normalB64: arrayBufferToBase64(normalBuf),
        boldB64: arrayBufferToBase64(boldBuf),
      };
    })();
  }
  return pdfFontDataPromise;
}

function registerDejaVuFontsOnDocument(doc: jsPDF, data: CachedDejaVu): void {
  doc.addFileToVFS('DejaVuSans.ttf', data.normalB64);
  doc.addFont('DejaVuSans.ttf', PDF_FONT, 'normal');
  doc.addFileToVFS('DejaVuSans-Bold.ttf', data.boldB64);
  doc.addFont('DejaVuSans-Bold.ttf', PDF_FONT, 'bold');
}

export function calculateOrderPrice(
  windowCount: number,
  floor: number,
  additionalServices: {
    balkonai: boolean;
    vitrinos: boolean;
    terasa: boolean;
    kiti: boolean;
  },
  settings: AppSettings
): number {
  let total = windowCount * settings.pricePerWindow;

  if (floor > 1) {
    total += (floor - 1) * settings.pricePerFloor;
  }

  if (additionalServices.balkonai) total += settings.priceBalkonai;
  if (additionalServices.vitrinos) total += settings.priceVitrinos;
  if (additionalServices.terasa) total += settings.priceTerasa;
  if (additionalServices.kiti) total += settings.priceKiti;

  return total;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('lt-LT', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('lt-LT');
}

export function formatDuration(minutes: number): string {
  if (!minutes) return '';
  const days = Math.floor(minutes / (24 * 60));
  const hours = Math.floor((minutes % (24 * 60)) / 60);
  const mins = minutes % 60;

  const parts = [];
  if (days > 0) parts.push(`${days} d.`);
  if (hours > 0) parts.push(`${hours} val.`);
  if (mins > 0 || parts.length === 0) parts.push(`${mins} min.`);

  return parts.join(' ');
}

/** Suspaudžia paveikslą į JPEG data URL saugojimui DB (užsakymo nuotraukos). */
export function compressImageToJpegDataUrl(
  file: File,
  maxWidth = 1280,
  quality = 0.82
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Pasirinkite paveikslo failą'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        try {
          let w = img.width;
          let h = img.height;
          if (w > maxWidth) {
            h = Math.round((h * maxWidth) / w);
            w = maxWidth;
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Naršyklė nepalaiko paveikslų apdorojimo'));
            return;
          }
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', quality));
        } catch {
          reject(new Error('Nepavyko apdoroti paveikslo'));
        }
      };
      img.onerror = () => reject(new Error('Nepavyko nuskaityti paveikslo'));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error('Nepavyko atidaryti failo'));
    reader.readAsDataURL(file);
  });
}

export async function geocodeAddress(
  address: string
): Promise<{ lat: number; lng: number } | null> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address + ', Lithuania')}`
    );
    const data = await response.json();
    if (data && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
      };
    }
    return null;
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}

export type InvoiceDeliveryMethod = 'email' | 'share' | 'mailto' | 'sms' | 'download';

export interface InvoiceDeliveryResult {
  method: InvoiceDeliveryMethod;
  detail: string;
}

/** Sutampa su vieša svetaine svarusdarbas.lt — tas pats prekės ženklas ir kontaktai. */
const INVOICE_EMAIL_SIGNATURE_LT =
  'Pagarbiai,\nŠvarus darbas\n\n' +
  '—\n' +
  'Profesionalios valymo paslaugos Klaipėdoje ir Vakarų Lietuvoje\n' +
  'info@svarusdarbas.lt · +370 6774 1151 · https://svarusdarbas.lt';

const INVOICE_MAIL_BODY_LT =
  'Labas,\n\nPridedu sąskaitą PDF (failą pridėkite iš atsisiuntimų aplanke — ką tik išsaugota).\n\n' +
  INVOICE_EMAIL_SIGNATURE_LT;

export function looksLikeValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/** Grąžina E.164 panašų numerį SMS URI arba null, jei telefonas neįvardijamas. */
function phoneForSmsUri(phone: string): string | null {
  const t = phone.trim();
  if (!t || t === 'nesutarta') return null;
  const d = t.replace(/\D/g, '');
  if (d.length < 8) return null;
  if (d.length === 9 && /^6[0-9]/.test(d)) return `+370${d}`;
  if (d.length === 10 && d.startsWith('0')) return `+370${d.slice(1)}`;
  if (d.length >= 11 && d.startsWith('370')) return `+${d}`;
  if (t.startsWith('+')) return t;
  return `+${d}`;
}

function downloadPdfBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Tuščia eilutė DEV reiškia: naudoti `/api/...` per Vite proxy → server.cjs:3001.
 * Produkcijoje tuščia = serverio nėra – automatinis el. paštas nebandomas.
 */
function getInvoiceApiBaseUrl(): string {
  const envUrl = (import.meta.env.VITE_INVOICE_API_BASE_URL as string | undefined)
    ?.trim()
    .replace(/\/$/, '');
  if (envUrl) return envUrl;
  try {
    const ls =
      typeof localStorage !== 'undefined'
        ? localStorage.getItem(INVOICE_API_STORAGE_KEY)?.trim()
        : '';
    if (ls) return ls.replace(/\/$/, '');
  } catch {
    /* private mode */
  }
  if (import.meta.env.DEV) return '';
  return '';
}

type InvoiceHealthJson = {
  status?: string;
  invoiceEmail?: boolean;
  backend?: string;
  hint?: string;
  proxyError?: string;
};

function invoiceHealthUrl(base: string): string {
  return base === '' ? '/health' : `${base.replace(/\/$/, '')}/health`;
}

const INVOICE_HEALTH_TTL_MS = 60_000;

type InvoiceHealthSnapshot = { httpOk: boolean; body: InvoiceHealthJson | null };

/**
 * Vienas /health skaitymas su TTL — ir „ar galima siųsti el. paštu“, ir toast hint’ai naudoja tą patį atsakymą
 * (išvengia dvigubo fetch vienam sąskaitos veiksmui).
 */
let invoiceHealthSnapshotCache: {
  base: string;
  expires: number;
  snapshot: InvoiceHealthSnapshot;
} | null = null;

async function getInvoiceHealthSnapshot(base: string): Promise<InvoiceHealthSnapshot> {
  const now = Date.now();
  if (
    invoiceHealthSnapshotCache &&
    invoiceHealthSnapshotCache.base === base &&
    invoiceHealthSnapshotCache.expires > now
  ) {
    return invoiceHealthSnapshotCache.snapshot;
  }

  try {
    const r = await fetch(invoiceHealthUrl(base), { cache: 'no-store' });
    if (!r.ok) {
      const snapshot = { httpOk: false, body: null };
      invoiceHealthSnapshotCache = { base, expires: now + 15_000, snapshot };
      return snapshot;
    }
    const body = (await r.json()) as InvoiceHealthJson;
    const snapshot = { httpOk: true, body };
    const invoiceEmail = !!body.invoiceEmail;
    invoiceHealthSnapshotCache = {
      base,
      expires: now + (invoiceEmail ? INVOICE_HEALTH_TTL_MS : 20_000),
      snapshot,
    };
    return snapshot;
  } catch {
    const snapshot = { httpOk: false, body: null };
    invoiceHealthSnapshotCache = { base, expires: now + 15_000, snapshot };
    return snapshot;
  }
}

/**
 * Aiškus tekstas vartotojui, kodėl automatinis el. paštas nebuvo naudojamas (be konsolės triukšmo).
 */
function invoiceAutomationHintFromHealth(h: InvoiceHealthJson | null, base: string): string | null {
  if (!h) {
    if (import.meta.env.PROD && base === '') return null;
    return (
      'Nepavyko pasiekti sąskaitų API (/health). Automatinis laiškas su PDF nebuvo siųstas. ' +
      (import.meta.env.DEV
        ? 'Lokaliai paleiskite API: npm run server (portas 3001) arba npm run dev:full.'
        : 'Patikrinkite, ar API adresas teisingas ir pasiekiamas.')
    );
  }
  if (h.backend === 'unavailable' || (h.proxyError && String(h.proxyError).length > 0)) {
    return (
      'API serveris nepasiekiamas (dažniausiai neveikia portas 3001). ' +
      'Paleiskite terminale: npm run server arba npm run dev:full, tada bandykite dar kartą.'
    );
  }
  if (!h.invoiceEmail) {
    return (
      'Automatinis el. paštas išjungtas: serveryje nėra RESEND_API_KEY (.env šalia server.cjs). ' +
      'PDF paruoštas — naudokite atsisiuntimą arba paštą toliau.'
    );
  }
  return null;
}

async function isInvoiceEmailServerReady(base: string): Promise<boolean> {
  const { httpOk, body } = await getInvoiceHealthSnapshot(base);
  return httpOk && !!body?.invoiceEmail;
}

function blobToBase64DataPart(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = r.result as string;
      const i = s.indexOf(',');
      resolve(i >= 0 ? s.slice(i + 1) : s);
    };
    r.onerror = () => reject(new Error('PDF skaitymas nepavyko'));
    r.readAsDataURL(blob);
  });
}

type TryServerEmailResult =
  | { kind: 'sent'; result: InvoiceDeliveryResult }
  | { kind: 'fallback' }
  | { kind: 'error'; message: string };

function enrichInvoiceEmailError(status: number, rawMessage: string): string {
  const msg = rawMessage.trim() || `HTTP ${status}`;
  const low = msg.toLowerCase();
  if (
    low.includes('verify a domain') ||
    low.includes('testing emails') ||
    low.includes('resend.com')
  ) {
    return (
      msg +
      ' — Patarimas: Resend → Domains: patvirtinkite domeną (pvz. svarusdarbas.lt), Render env Nustatykite RESEND_FROM_EMAIL iš to domeno. Kol domenas nepatvirtintas, testuokite tik siųsdami į savo patvirtintą paštą (Resend account email).'
    );
  }
  if (status === 502 || status === 503 || status === 524) {
    if (!rawMessage || rawMessage === `HTTP ${status}`) {
      return (
        'API serveris nepasiekiamas (' +
        status +
        '). Jei API ant Render Free — palaukite ~30–60 s („miegas“), atverkite /health naršyklėje, tada bandykite vėl.'
      );
    }
  }
  return msg;
}

/**
 * Siunčia PDF į kliento el. paštą per server.cjs + Resend (be rankinio pridėjimo naršyklėje).
 */
async function trySendInvoiceEmailViaServer(
  order: Order,
  client: Client,
  blob: Blob,
  filename: string
): Promise<TryServerEmailResult> {
  const to = client.email?.trim() ?? '';
  if (!to || !looksLikeValidEmail(to)) {
    return { kind: 'fallback' };
  }

  const base = getInvoiceApiBaseUrl();
  // Tuščias base dev'e = tas pats hostas + Vite proxy į server.cjs (`/api/...`).
  if (!base && !import.meta.env.DEV) {
    return { kind: 'fallback' };
  }

  if (usesLocalStorageBackend || !supabase) {
    return { kind: 'fallback' };
  }

  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token;
  if (!token) {
    return { kind: 'fallback' };
  }

  if (!(await isInvoiceEmailServerReady(base))) {
    return { kind: 'fallback' };
  }

  let pdfBase64: string;
  try {
    pdfBase64 = await blobToBase64DataPart(blob);
  } catch {
    return { kind: 'error', message: 'Nepavyko paruošti PDF siuntimui.' };
  }

  const subject = `Sąskaita – ${order.clientName || client.name || 'klientas'}`;
  const text =
    'Sveiki,\n\nPridedame sąskaitą PDF formatu už suteiktas paslaugas.\n\nKlausimus galite užduoti atsakydami į šį laišką.\n\n' +
    INVOICE_EMAIL_SIGNATURE_LT;

  const sendUrl =
    base === '' ? '/api/send-invoice-email' : `${base.replace(/\/$/, '')}/api/send-invoice-email`;

  try {
    const res = await fetch(sendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ to, subject, text, pdfBase64, filename, orderId: order.id }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string; ok?: boolean };

    if (res.ok && data.ok) {
      return {
        kind: 'sent',
        result: {
          method: 'email',
          detail: `Sąskaita automatiškai išsiųsta į ${to} (klientas gaus laišką su PDF).`,
        },
      };
    }

    if (res.status === 503) {
      return { kind: 'fallback' };
    }

    const rawErr = data.error ? String(data.error) : '';
    const err = enrichInvoiceEmailError(res.status, rawErr || `HTTP ${res.status}`);
    return { kind: 'error', message: err };
  } catch (e) {
    if (e instanceof TypeError) {
      return { kind: 'fallback' };
    }
    throw e;
  }
}

function canSharePdfFile(file: File): boolean {
  try {
    return (
      typeof navigator.share === 'function' &&
      (typeof navigator.canShare !== 'function' || navigator.canShare({ files: [file] }))
    );
  } catch {
    return false;
  }
}

/** „Bendrinti“ su PDF dažnai atveria nepatogų Windows dialogą — mobiliuose paliekame. */
function isLikelyMobileOrTablet(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

/**
 * Dalijimasis / „mailto:“ / SMS / atsisiuntimas. Naršyklė ne visada leidžia prisegti PDF automatiškai —
 * staliniame PC pirmiausia atsisiuntimas + „mailto:", ne Windows „Bendrinti“.
 */
export async function deliverInvoicePdf(
  order: Order,
  client: Client,
  blob: Blob,
  filename: string
): Promise<InvoiceDeliveryResult> {
  const file = new File([blob], filename, { type: 'application/pdf' });
  const shareTitle = 'Sąskaita';
  const shareText = `Sąskaita — ${order.clientName || client.name || ''}`.trim();

  if (isLikelyMobileOrTablet() && canSharePdfFile(file)) {
    try {
      await navigator.share({ files: [file], title: shareTitle, text: shareText });
      return {
        method: 'share',
        detail: 'Pasirinkite programą (paštas, žinutės ir kt.), kad išsiųstumėte PDF klientui.',
      };
    } catch (e) {
      const name =
        e && typeof e === 'object' && 'name' in e ? String((e as { name: string }).name) : '';
      if (name === 'AbortError') {
        return { method: 'download', detail: 'Bendrinimas atšauktas.' };
      }
    }
  }

  downloadPdfBlob(blob, filename);

  const email = client.email?.trim() ?? '';
  if (email && looksLikeValidEmail(email)) {
    const subject = encodeURIComponent(
      `Sąskaita – ${order.clientName || client.name || 'klientas'}`
    );
    const body = encodeURIComponent(INVOICE_MAIL_BODY_LT);
    const mailtoHref = `mailto:${encodeURIComponent(email)}?subject=${subject}&body=${body}`;
    // Po async (PDF + fetch) naršyklė blokuoja mailto be naujo vartotojo veiksmo — „Gerai“ čia jį atkuria.
    const openMail = window.confirm(
      'PDF išsaugotas į atsisiuntimus.\n\nAtidaryti el. pašto programą su užpildytu gavėju?\n(Laiške prisekite PDF iš aplanko „Atsisiuntimai“.)'
    );
    if (openMail) {
      window.location.href = mailtoHref;
    }
    return {
      method: 'mailto',
      detail: openMail
        ? 'PDF išsaugotas. Jei paštas neatsidarė, atidarykite jį patys ir įkelkite failą.'
        : 'PDF išsaugotas atsisiuntimuose. Atidarykite paštą ir įkelkite PDF rankiniu būdu.',
    };
  }

  const smsDest = client.phone ? phoneForSmsUri(client.phone) : null;
  if (smsDest) {
    const text = encodeURIComponent(
      `Sąskaita PDF: ${filename}. Failą rasite atsisiuntimuose — galite persiųsti kaip priedą.`
    );
    const smsHref = `sms:${smsDest}?body=${text}`;
    const openSms = window.confirm(
      'PDF išsaugotas į atsisiuntimus.\n\nAtidaryti SMS žinutę su paruoštu tekstu?'
    );
    if (openSms) {
      window.location.href = smsHref;
    }
    return {
      method: 'sms',
      detail: openSms
        ? 'Jei SMS neatsidarė, parašykite klientui patys ir prisekite PDF.'
        : 'PDF išsaugotas atsisiuntimuose.',
    };
  }

  return {
    method: 'download',
    detail:
      'PDF atsisiųstas. Pridėkite klientui el. paštą arba telefoną kortelėje, kad kitą kartą būtų galima atidaryti siuntimą automatiškai.',
  };
}

async function buildInvoiceJsPdf(order: Order, client: Client): Promise<jsPDF> {
  const fontData = await loadDejaVuFontData();
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  registerDejaVuFontsOnDocument(doc, fontData);

  const M = 16;
  const pageW = 210;
  const colW = (pageW - 2 * M - 10) / 2;
  const accent: [number, number, number] = [18, 62, 88];
  const muted: [number, number, number] = [71, 85, 105];

  doc.setFont(PDF_FONT, 'normal');

  doc.setFillColor(...accent);
  doc.rect(0, 0, pageW, 22, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont(PDF_FONT, 'bold');
  doc.setFontSize(15);
  doc.text('Sąskaita faktūra', pageW / 2, 13, { align: 'center' });
  doc.setFont(PDF_FONT, 'normal');
  doc.setFontSize(8.5);
  const issueDate = formatDate(new Date().toISOString());
  const invNo = order.id.replace(/-/g, '').slice(0, 10).toUpperCase();
  doc.text(`Serija SD  ·  Nr. ${invNo}  ·  Išrašymo data: ${issueDate}`, pageW / 2, 18.5, {
    align: 'center',
  });
  doc.setTextColor(0, 0, 0);

  let y = 30;
  doc.setFontSize(9);
  doc.setTextColor(...muted);
  doc.text(`Paslaugos data: ${formatDate(order.date)}  ·  Laikas: ${order.time || '—'}`, M, y);
  y += 8;
  doc.setTextColor(0, 0, 0);

  doc.setFontSize(8);
  doc.setTextColor(...muted);
  doc.setFont(PDF_FONT, 'bold');
  doc.text('PARDAVĖJAS', M, y);
  doc.text('PIRKĖJAS', M + colW + 10, y);
  y += 5;
  doc.setFont(PDF_FONT, 'normal');
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(9.5);

  const leftX = M;
  const rightX = M + colW + 10;
  let yL = y;
  let yR = y;

  doc.setFont(PDF_FONT, 'bold');
  doc.text(INVOICE_VENDOR.name, leftX, yL);
  yL += 5;
  doc.setFont(PDF_FONT, 'normal');
  yL += 2;
  const sellerLines = [
    `Įm. kodas: ${INVOICE_VENDOR.regCode}`,
    `PVM kodas: ${INVOICE_VENDOR.vatCode}`,
    `Adresas: ${INVOICE_VENDOR.address}`,
    `Tel.: ${INVOICE_VENDOR.phone}`,
    `El. paštas: ${INVOICE_VENDOR.email}`,
  ];
  for (const line of sellerLines) {
    doc.text(line, leftX, yL);
    yL += 4.5;
  }

  doc.setFont(PDF_FONT, 'bold');
  doc.text(client.name || '—', rightX, yR);
  yR += 5;
  doc.setFont(PDF_FONT, 'normal');
  yR += 2;
  const buyerBits = [`Tel.: ${client.phone || '—'}`];
  const em = client.email?.trim();
  if (em) buyerBits.push(`El. paštas: ${em}`);
  buyerBits.push(`Adresas: ${client.address || '—'}`);
  const buyerLines = doc.splitTextToSize(buyerBits.join('\n'), colW);
  doc.text(buyerLines, rightX, yR);
  yR += buyerLines.length * 4.5;

  y = Math.max(yL, yR) + 8;

  const wc = Math.max(1, order.windowCount || 0);
  const unit = order.totalPrice / wc;
  const tableData: string[][] = [
    [
      'Langų valymas',
      `${order.windowCount} vnt.`,
      formatCurrency(unit),
      formatCurrency(order.totalPrice),
    ],
  ];

  if (order.additionalServices.balkonai) {
    tableData.push(['Papildomai: balkonų valymas', '1 pasl.', '—', '—']);
  }
  if (order.additionalServices.vitrinos) {
    tableData.push(['Papildomai: vitrinų valymas', '1 pasl.', '—', '—']);
  }
  if (order.additionalServices.terasa) {
    tableData.push(['Papildomai: terasos valymas', '1 pasl.', '—', '—']);
  }
  if (order.additionalServices.kiti) {
    tableData.push(['Papildomai: kiti paviršiai', '1 pasl.', '—', '—']);
  }

  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    head: [['Paslauga', 'Kiekis', 'Vieneto kaina', 'Suma']],
    body: tableData,
    theme: 'striped',
    styles: {
      font: PDF_FONT,
      fontSize: 9,
      cellPadding: 3,
      textColor: [15, 23, 42],
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
    },
    headStyles: {
      font: PDF_FONT,
      fontStyle: 'bold',
      fillColor: accent,
      textColor: [255, 255, 255],
      halign: 'left',
    },
    columnStyles: {
      1: { halign: 'center', cellWidth: 22 },
      2: { halign: 'right', cellWidth: 32 },
      3: { halign: 'right', cellWidth: 32 },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  const finalY =
    (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? y + 40;
  const totalY = finalY + 14;

  doc.setDrawColor(...muted);
  doc.setLineWidth(0.3);
  doc.line(M, totalY - 6, pageW - M, totalY - 6);

  doc.setFont(PDF_FONT, 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  const totalLine = `Iš viso mokėti: ${formatCurrency(order.totalPrice)}`;
  doc.text(totalLine, pageW - M, totalY, { align: 'right' });

  const footTop = 252;
  doc.setFont(PDF_FONT, 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...muted);
  doc.text('Mokėjimo duomenys', M, footTop);
  doc.setTextColor(0, 0, 0);
  doc.text(`Gavėjas: ${INVOICE_VENDOR.name}  ·  ${INVOICE_VENDOR.bank}`, M, footTop + 4.5);
  doc.text(`IBAN: ${INVOICE_VENDOR.iban}  ·  Įm. kodas: ${INVOICE_VENDOR.regCode}`, M, footTop + 9);

  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(
    'Sąskaitą sugeneravo „Švarus Darbas“ CRM. Dokumentas yra preliminarus — prieš siųsdami klientui patikrinkite rekvizitus.',
    M,
    footTop + 16,
    { maxWidth: pageW - 2 * M }
  );

  return doc;
}

export async function createInvoicePdfBlob(
  order: Order,
  client: Client
): Promise<{ blob: Blob; filename: string }> {
  const doc = await buildInvoiceJsPdf(order, client);
  const safeName = (order.clientName || 'klientas').replace(/[^\w\u00C0-\u024f-]+/gi, '_');
  const filename = `saskaita_${safeName}_${order.date}.pdf`;
  return { blob: doc.output('blob'), filename };
}

/**
 * Sugeneruoja sąskaitos PDF ir, jei įmanoma, automatiškai išsiunčia į kliento el. paštą
 * (server.cjs + Resend). Kitu atveju — Web Share / „mailto:“ / SMS / atsisiuntimas.
 */
export async function generateInvoicePDF(
  order: Order,
  client: Client
): Promise<InvoiceDeliveryResult> {
  const { blob, filename } = await createInvoicePdfBlob(order, client);
  const base = getInvoiceApiBaseUrl();

  const serverTry = await trySendInvoiceEmailViaServer(order, client, blob, filename);
  if (serverTry.kind === 'sent') {
    return serverTry.result;
  }
  if (serverTry.kind === 'error') {
    throw new Error(serverTry.message);
  }

  const hasClientEmail = !!(client.email?.trim() && looksLikeValidEmail(client.email.trim()));
  let hint: string | null = null;
  if (hasClientEmail && (import.meta.env.DEV || base !== '')) {
    const { body: healthBody } = await getInvoiceHealthSnapshot(base);
    hint = invoiceAutomationHintFromHealth(healthBody, base);
  }

  const result = await deliverInvoicePdf(order, client, blob, filename);
  if (hint) {
    return { ...result, detail: `${hint.trim()}\n\n${result.detail}` };
  }
  return result;
}
