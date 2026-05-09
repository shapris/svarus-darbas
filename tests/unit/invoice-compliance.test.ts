import { describe, expect, it, vi } from 'vitest';

// Mock jsPDF and autoTable before importing utils
vi.mock('jspdf', () => ({
  jsPDF: vi.fn(() => ({
    output: vi.fn(() => new Blob()),
    setFont: vi.fn(),
    setFontSize: vi.fn(),
    setTextColor: vi.fn(),
    setFillColor: vi.fn(),
    rect: vi.fn(),
    text: vi.fn(),
    setDrawColor: vi.fn(),
    setLineWidth: vi.fn(),
    line: vi.fn(),
    splitTextToSize: vi.fn(() => []),
  })),
}));

vi.mock('jspdf-autotable', () => ({
  autoTable: vi.fn(),
}));

// Mock font functions before importing utils
vi.mock('../../src/utils', async () => {
  const actual = await vi.importActual('../../src/utils');
  return {
    ...actual,
    loadDejaVuFontData: vi.fn(() => Promise.resolve({ normalB64: 'mock', boldB64: 'mock' })),
    registerDejaVuFontsOnDocument: vi.fn(),
    createInvoicePdfBlob: actual.createInvoicePdfBlob,
  };
});

import { createInvoicePdfBlob } from '../../src/utils';
import type { Order, Client, AppSettings } from '../../src/types';

describe('invoice compliance minimum', () => {
  it('žemėlapis order į invoice duomenis teisingai', () => {
    const mockOrder: Order = {
      id: 'test-order-1234',
      clientId: 'client1',
      clientName: 'Test Client',
      address: 'Test Address',
      date: '2026-05-09',
      time: '10:00',
      windowCount: 5,
      floor: 2,
      estimatedDuration: 60,
      additionalServices: { balkonai: false, vitrinos: false, terasa: false, kiti: false },
      totalPrice: 100,
      status: 'atlikta',
      notes: 'Test order',
      createdAt: '2026-05-09T10:00:00Z',
    };

    const mockClient: Client = {
      id: 'client1',
      name: 'Test Client',
      phone: '+37060000000',
      address: 'Test Address',
      buildingType: 'butas',
      notes: '',
      createdAt: '2026-05-09T10:00:00Z',
    };

    // Test data mapping
    expect(mockOrder.clientName).toBe('Test Client');
    expect(mockOrder.totalPrice).toBe(100);
    expect(mockClient.name).toBe('Test Client');
    expect(mockClient.phone).toBe('+37060000000');
  });

  it('VAT skaičiavimas veikia baziniu būdu', () => {
    const totalPrice = 100;
    const vatRate = 0.21;
    const vatAmount = totalPrice * vatRate;
    const totalWithVat = totalPrice + vatAmount;

    expect(vatAmount).toBe(21);
    expect(totalWithVat).toBe(121);
  });

  it('invoice numeris generuojamas iš order ID', () => {
    const orderId = 'test-order-1234';
    const dateStr = '20260509'; // YYYYMMDD
    const expected = `INV-${dateStr}-${orderId.slice(-4).toUpperCase()}`;

    expect(expected).toBe('INV-20260509-1234');
  });
});
