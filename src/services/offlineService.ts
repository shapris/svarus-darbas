/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Client, Order, Expense, AppSettings } from '../types';

export interface OfflineData {
  clients: Client[];
  orders: Order[];
  expenses: Expense[];
  settings: AppSettings;
  lastSync: Date;
}

export interface SyncOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  table: string;
  data: any;
  timestamp: Date;
  status: 'pending' | 'syncing' | 'completed' | 'failed';
}

export class OfflineService {
  private static instance: OfflineService;
  private db: IDBDatabase | null = null;
  private syncQueue: SyncOperation[] = [];
  private isOnline = navigator.onLine;
  private syncInProgress = false;

  static getInstance(): OfflineService {
    if (!OfflineService.instance) {
      OfflineService.instance = new OfflineService();
    }
    return OfflineService.instance;
  }

  async initialize(): Promise<void> {
    try {
      await this.initDB();
      this.loadSyncQueue();
      this.setupEventListeners();

      // Try to sync if online
      if (this.isOnline) {
        this.syncAll();
      }
    } catch (error) {
      console.error('Failed to initialize offline service:', error);
    }
  }

  private async initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('LangiuValymasOffline', 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object stores
        if (!db.objectStoreNames.contains('clients')) {
          db.createObjectStore('clients', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('orders')) {
          db.createObjectStore('orders', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('expenses')) {
          db.createObjectStore('expenses', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('syncQueue')) {
          db.createObjectStore('syncQueue', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('offlineData')) {
          db.createObjectStore('offlineData', { keyPath: 'id' });
        }
      };
    });
  }

  private setupEventListeners(): void {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.syncAll();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  }

  // Data storage methods
  async saveData<T>(storeName: string, data: T[]): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const transaction = this.db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);

    // Clear existing data
    await store.clear();

    // Add new data
    for (const item of data) {
      await store.add(item);
    }

    // Save to offline data snapshot
    await this.saveOfflineSnapshot();
  }

  async getData<T>(storeName: string): Promise<T[]> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result as T[]);
    });
  }

  async saveOfflineSnapshot(): Promise<void> {
    if (!this.db) return;

    try {
      const [clients, orders, expenses, settings] = await Promise.all([
        this.getData<Client>('clients'),
        this.getData<Order>('orders'),
        this.getData<Expense>('expenses'),
        this.getData<AppSettings>('settings'),
      ]);

      const snapshot: OfflineData = {
        clients,
        orders,
        expenses,
        settings: settings[0] || ({} as AppSettings),
        lastSync: new Date(),
      };

      const transaction = this.db.transaction('offlineData', 'readwrite');
      const store = transaction.objectStore('offlineData');
      await store.put({ id: 'snapshot', ...snapshot });
    } catch (error) {
      console.error('Failed to save offline snapshot:', error);
    }
  }

  async getOfflineSnapshot(): Promise<OfflineData | null> {
    if (!this.db) return null;

    return new Promise((resolve) => {
      const transaction = this.db!.transaction('offlineData', 'readonly');
      const store = transaction.objectStore('offlineData');
      const request = store.get('snapshot');

      request.onerror = () => resolve(null);
      request.onsuccess = () => resolve(request.result || null);
    });
  }

  // Sync queue management
  private async loadSyncQueue(): Promise<void> {
    if (!this.db) return;

    try {
      this.syncQueue = await this.getData<SyncOperation>('syncQueue');
    } catch (error) {
      console.error('Failed to load sync queue:', error);
      this.syncQueue = [];
    }
  }

  private async saveSyncQueue(): Promise<void> {
    if (!this.db) return;

    try {
      await this.saveData('syncQueue', this.syncQueue);
    } catch (error) {
      console.error('Failed to save sync queue:', error);
    }
  }

  addToSyncQueue(operation: Omit<SyncOperation, 'id' | 'timestamp' | 'status'>): void {
    const syncOp: SyncOperation = {
      ...operation,
      id: `${Date.now()}-${Math.random()}`,
      timestamp: new Date(),
      status: 'pending',
    };

    this.syncQueue.push(syncOp);
    this.saveSyncQueue();

    if (this.isOnline && !this.syncInProgress) {
      this.syncAll();
    }
  }

  async syncAll(): Promise<void> {
    if (!this.isOnline || this.syncInProgress || this.syncQueue.length === 0) {
      return;
    }

    this.syncInProgress = true;

    try {
      const pendingOps = this.syncQueue.filter((op) => op.status === 'pending');

      for (const operation of pendingOps) {
        await this.syncOperation(operation);
      }

      // Clean up completed operations
      this.syncQueue = this.syncQueue.filter((op) => op.status !== 'completed');
      await this.saveSyncQueue();
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      this.syncInProgress = false;
    }
  }

  private async syncOperation(operation: SyncOperation): Promise<void> {
    try {
      operation.status = 'syncing';
      await this.saveSyncQueue();

      // Here you would implement actual sync logic with your backend
      // For now, we'll simulate successful sync
      await new Promise((resolve) => setTimeout(resolve, 1000));

      operation.status = 'completed';
      await this.saveSyncQueue();
    } catch (error) {
      operation.status = 'failed';
      await this.saveSyncQueue();
      throw error;
    }
  }

  // Conflict resolution
  async resolveConflicts(): Promise<void> {
    // Implement conflict resolution logic
    // This would compare local and remote data and resolve conflicts
  }

  // Storage management
  async getStorageUsage(): Promise<{
    used: number;
    quota: number;
    percentage: number;
  }> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      const used = estimate.usage || 0;
      const quota = estimate.quota || 0;

      return {
        used,
        quota,
        percentage: quota > 0 ? (used / quota) * 100 : 0,
      };
    }

    return { used: 0, quota: 0, percentage: 0 };
  }

  async clearOldData(): Promise<void> {
    if (!this.db) return;

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Clear old completed sync operations
    this.syncQueue = this.syncQueue.filter(
      (op) => op.status !== 'completed' || new Date(op.timestamp) > thirtyDaysAgo
    );

    await this.saveSyncQueue();
  }

  // Network status
  isOnlineStatus(): boolean {
    return this.isOnline;
  }

  getSyncStatus(): {
    pending: number;
    syncing: number;
    failed: number;
    lastSync: Date | null;
  } {
    const pending = this.syncQueue.filter((op) => op.status === 'pending').length;
    const syncing = this.syncQueue.filter((op) => op.status === 'syncing').length;
    const failed = this.syncQueue.filter((op) => op.status === 'failed').length;

    const lastSyncOp = this.syncQueue
      .filter((op) => op.status === 'completed')
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];

    return {
      pending,
      syncing,
      failed,
      lastSync: lastSyncOp ? new Date(lastSyncOp.timestamp) : null,
    };
  }

  // Background sync
  async registerBackgroundSync(): Promise<void> {
    if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
      try {
        const registration = await navigator.serviceWorker.ready;
        const syncReg = registration as ServiceWorkerRegistration & {
          sync: { register: (tag: string) => Promise<void> };
        };
        await syncReg.sync.register('background-sync');
      } catch (error) {
        console.error('Background sync registration failed:', error);
      }
    }
  }

  // Cache management for PWA
  async cacheResources(resources: string[]): Promise<void> {
    if ('caches' in window) {
      const cache = await caches.open('langiu-valymas-v1');
      await cache.addAll(resources);
    }
  }

  async getCachedResources(): Promise<string[]> {
    if ('caches' in window) {
      const cache = await caches.open('langiu-valymas-v1');
      return await cache.keys().then((requests) => requests.map((req) => req.url));
    }
    return [];
  }

  // Cleanup
  async cleanup(): Promise<void> {
    await this.clearOldData();

    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

export const offlineService = OfflineService.getInstance();
