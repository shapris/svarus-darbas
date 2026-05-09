import { describe, expect, it, vi, beforeEach } from 'vitest';
import { clearAllDemoData, exportAllData } from '../../src/localDb';

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  key: vi.fn(),
  length: 0,
};

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

describe('data export delete minimum', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock
    mockLocalStorage.getItem.mockImplementation(() => null);
    mockLocalStorage.setItem.mockImplementation(() => {});
    mockLocalStorage.removeItem.mockImplementation(() => {});
    mockLocalStorage.key.mockImplementation((i: number) => {
      const keys = ['svaraus_darbas_clients', 'svaraus_darbas_orders', 'svaraus_darbas_expenses'];
      return i < keys.length ? keys[i] : null;
    });
    mockLocalStorage.length = 3;
  });

  it('exportAllData neįtraukia secrets', () => {
    mockLocalStorage.getItem.mockImplementation((key: string) => {
      if (key === 'svaraus_darbas_clients') return '[{"id": "1", "name": "Test Client"}]';
      if (key === 'svaraus_darbas_orders') return '[{"id": "1", "clientName": "Test"}]';
      if (key === 'svaraus_darbas_expenses') return '[{"id": "1", "amount": 100}]';
      return null;
    });

    const result = exportAllData();

    const parsed = JSON.parse(result);
    expect(parsed.data).toHaveProperty('clients');
    expect(parsed.data).toHaveProperty('orders');
    expect(parsed.data).toHaveProperty('expenses');
    expect(parsed.data).not.toHaveProperty('secrets');
    expect(parsed.version).toBe('1.0');
  });

  it('clearAllDemoData išvalo tik demo duomenis', () => {
    mockLocalStorage.getItem.mockImplementation((key: string) => {
      if (key.startsWith('svaraus_darbas_')) return '[]';
      return null;
    });

    const result = clearAllDemoData();

    expect(result.success).toBe(true);
    expect(result.message).toContain('Išvalyti');
    expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('svaraus_darbas_clients');
    expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('svaraus_darbas_orders');
    expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('svaraus_darbas_expenses');
    expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('svaraus_darbas_employees');
    expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('svaraus_darbas_memories');
    expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('svaraus_darbas_settings');
  });

  it('clearAllDemoData reikalauja patvirtinimo (testas netaikomas UI)', () => {
    // UI confirmation is tested separately, here we just test the function
    const result = clearAllDemoData();
    expect(result).toHaveProperty('success');
  });

  it('export įtraukia demo kategorijas', () => {
    mockLocalStorage.getItem.mockImplementation((key: string) => {
      if (key === 'svaraus_darbas_clients') return '[{"id": "1", "name": "Client"}]';
      if (key === 'svaraus_darbas_orders') return '[{"id": "1", "status": "atlikta"}]';
      if (key === 'svaraus_darbas_expenses') return '[{"id": "1", "amount": 50}]';
      return null;
    });

    const result = exportAllData();
    const parsed = JSON.parse(result);

    expect(parsed.data.clients).toEqual([{ id: '1', name: 'Client' }]);
    expect(parsed.data.orders).toEqual([{ id: '1', status: 'atlikta' }]);
    expect(parsed.data.expenses).toEqual([{ id: '1', amount: 50 }]);
  });
});
