import { describe, expect, it } from 'vitest';
import {
  normalizeAddressForMatch,
  resolveClientRecordForOrder,
  resolveOrderClientNameDisplay,
} from '../src/utils/orderDisplayHelpers';
import type { Client, Order } from '../src/types';

const baseOrder = (o: Partial<Order>): Order =>
  ({
    id: 'o1',
    clientId: 'c-old',
    clientName: '',
    address: '',
    date: '2026-04-11',
    time: '10:00',
    windowCount: 1,
    floor: 1,
    additionalServices: { balkonai: false, vitrinos: false, terasa: false, kiti: false },
    totalPrice: 0,
    status: 'suplanuota',
    createdAt: new Date().toISOString(),
    ...o,
  }) as Order;

describe('normalizeAddressForMatch', () => {
  it('suvienodina tarpus ir registro raidžių', () => {
    expect(normalizeAddressForMatch('  Pišlių g. 69  ')).toBe('pišlių g. 69');
  });
});

describe('resolveOrderClientNameDisplay', () => {
  it('grąžina vardą iš užsakymo', () => {
    const clients: Client[] = [];
    expect(resolveOrderClientNameDisplay(baseOrder({ clientName: 'Jonas' }), clients)).toBe(
      'Jonas'
    );
  });

  it('ima vardą pagal clientId', () => {
    const clients: Client[] = [
      {
        id: 'c1',
        name: 'Ona',
        phone: '1',
        address: 'A',
        buildingType: 'nesutarta',
        createdAt: '',
      },
    ];
    expect(
      resolveOrderClientNameDisplay(baseOrder({ clientId: 'c1', address: 'B' }), clients)
    ).toBe('Ona');
  });

  it('kai clientId nebeatitinka, bet adresas sutampa su viena kortele — rodo tą vardą', () => {
    const clients: Client[] = [
      {
        id: 'c-real',
        name: 'Petras P.',
        phone: '1',
        address: 'Pišlių g. 69',
        buildingType: 'nesutarta',
        createdAt: '',
      },
    ];
    const order = baseOrder({
      clientId: 'deleted-or-stale-id',
      clientName: '',
      address: 'Pišlių g. 69',
    });
    expect(resolveOrderClientNameDisplay(order, clients)).toBe('Petras P.');
  });

  it('resolveClientRecordForOrder: pagal adresą suranda kortelę, kai clientId pasenęs', () => {
    const clients: Client[] = [
      {
        id: 'c-real',
        name: 'Petras P.',
        phone: '+37060000000',
        address: 'Pišlių g. 69',
        buildingType: 'nesutarta',
        createdAt: '',
      },
    ];
    const order = baseOrder({
      clientId: 'stale',
      clientName: '',
      address: 'Pišlių g. 69',
    });
    expect(resolveClientRecordForOrder(order, clients)?.phone).toBe('+37060000000');
  });

  it('keli skirtingi vardai tame pačiame adrese — nespėlioja', () => {
    const clients: Client[] = [
      {
        id: 'a',
        name: 'A',
        phone: '1',
        address: 'X g. 1',
        buildingType: 'nesutarta',
        createdAt: '',
      },
      {
        id: 'b',
        name: 'B',
        phone: '2',
        address: 'X g. 1',
        buildingType: 'nesutarta',
        createdAt: '',
      },
    ];
    expect(
      resolveOrderClientNameDisplay(
        baseOrder({ clientId: 'x', clientName: '', address: 'X g. 1' }),
        clients
      )
    ).toBe('');
  });
});
