/**
 * Local Storage Database Service
 * Vietinė persistencija naršyklėje (localStorage), kai debesis išjungtas.
 */

const STORAGE_PREFIX = 'svaraus_darbas_';

// Helper to get collection from localStorage
function getCollection<T>(collectionName: string): T[] {
  const data = localStorage.getItem(STORAGE_PREFIX + collectionName);
  return data ? JSON.parse(data) : [];
}

// Helper to save collection to localStorage
function saveCollection<T>(collectionName: string, data: T[]): void {
  localStorage.setItem(STORAGE_PREFIX + collectionName, JSON.stringify(data));
}

// Generate unique ID
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Simple auth functions
const USERS_KEY = STORAGE_PREFIX + 'users';
const CURRENT_USER_KEY = STORAGE_PREFIX + 'current_user';

interface LocalUser {
  id: string;
  email: string;
  password: string;
  displayName: string;
  createdAt: string;
}

interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function registerUser(email: string, password: string, displayName: string): User {
  const users = getCollection<LocalUser>(USERS_KEY);
  const emailNorm = normalizeEmail(email);

  // Check if user exists
  if (users.find((u) => normalizeEmail(u.email) === emailNorm)) {
    throw new Error('Vartotojas su tokiu el. paštu jau egzistuoja');
  }

  const newUser: LocalUser = {
    id: generateId(),
    email: emailNorm,
    password, // In production, this should be hashed
    displayName,
    createdAt: new Date().toISOString(),
  };

  users.push(newUser);
  saveCollection(USERS_KEY, users);

  // Auto-login after registration
  const user: User = {
    uid: newUser.id,
    email: newUser.email,
    displayName: newUser.displayName,
    photoURL: null,
  };
  localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));

  return user;
}

export function loginUser(email: string, password: string): User {
  const users = getCollection<LocalUser>(USERS_KEY);
  const emailNorm = normalizeEmail(email);
  const user = users.find((u) => normalizeEmail(u.email) === emailNorm && u.password === password);

  if (!user) {
    const emailExists = users.some((u) => normalizeEmail(u.email) === emailNorm);
    if (users.length === 0) {
      throw new Error(
        'Šioje naršyklėje dar nėra vietinių paskyrų. Pasirinkite „Sukurti darbuotojo paskyrą“ arba naudokite kūrimo prisijungimą: demo@example.com / demo123.'
      );
    }
    if (emailExists) {
      throw new Error('Neteisingas slaptažodis.');
    }
    throw new Error(
      'Toks el. paštas nerastas vietinėje saugykloje. Jei paskyra sukurta debesyje (Supabase), įrašykite VITE_SUPABASE_URL ir VITE_SUPABASE_ANON_KEY į .env. Kūrimui be debesies: demo@example.com / demo123.'
    );
  }

  const userData: User = {
    uid: user.id,
    email: user.email,
    displayName: user.displayName,
    photoURL: null,
  };

  localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(userData));
  return userData;
}

export function logoutUser(): void {
  localStorage.removeItem(CURRENT_USER_KEY);
}

export function getCurrentUser(): User | null {
  const data = localStorage.getItem(CURRENT_USER_KEY);
  return data ? JSON.parse(data) : null;
}

// Data access functions (similar to Firestore)
interface DataRecord {
  id: string;
  uid?: string;
  [key: string]: any;
}

export function getData<T extends DataRecord>(collectionName: string, userId: string): T[] {
  const data = getCollection<T>(collectionName);
  return data.filter((item) => item.uid === userId);
}

export function getDataById<T extends DataRecord>(collectionName: string, id: string): T | null {
  const data = getCollection<T>(collectionName);
  return data.find((item) => item.id === id) || null;
}

type DataListener = (data: DataRecord[]) => void;
const listeners: Record<string, DataListener[]> = {};

export function addData<T extends DataRecord>(
  collectionName: string,
  userId: string,
  item: Omit<T, 'id' | 'uid'>
): T {
  const data = getCollection<T>(collectionName);
  const newItem = {
    ...item,
    id: generateId(),
    uid: userId,
  } as T;
  data.push(newItem);
  saveCollection(collectionName, data);
  notifyChange(collectionName, userId);
  return newItem;
}

export function updateData<T extends DataRecord>(
  collectionName: string,
  id: string,
  updates: Partial<T>
): void {
  const data = getCollection<T>(collectionName);
  const index = data.findIndex((item) => item.id === id);
  if (index !== -1) {
    const uid = data[index].uid;
    data[index] = { ...data[index], ...updates };
    saveCollection(collectionName, data);
    if (uid) notifyChange(collectionName, uid);
  }
}

export function deleteData(collectionName: string, id: string): void {
  const data = getCollection<DataRecord>(collectionName);
  const row = data.find((item) => item.id === id);
  const filtered = data.filter((item) => item.id !== id);
  saveCollection(collectionName, filtered);
  if (row?.uid) notifyChange(collectionName, row.uid);
}

// Real-time subscription simulation
export function subscribeToData<T extends DataRecord>(
  collectionName: string,
  userId: string,
  callback: (data: T[]) => void
): () => void {
  const key = `${collectionName}_${userId}`;

  if (!listeners[key]) {
    listeners[key] = [];
  }

  const wrapped: DataListener = (rows) => callback(rows as T[]);
  listeners[key].push(wrapped);

  // Initial data
  callback(getData<T>(collectionName, userId));

  return () => {
    const idx = listeners[key].indexOf(wrapped);
    if (idx !== -1) {
      listeners[key].splice(idx, 1);
    }
  };
}

export function notifyChange(collectionName: string, userId: string): void {
  const key = `${collectionName}_${userId}`;
  const cbs = listeners[key];
  if (!cbs?.length) return;
  const rows = getData<DataRecord>(collectionName, userId);
  cbs.forEach((cb) => cb(rows));
}

// Export all data to JSON file
export function exportAllData(): string {
  const data: Record<string, any> = {};

  // Get all keys from localStorage with our prefix
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(STORAGE_PREFIX)) {
      const collectionName = key.replace(STORAGE_PREFIX, '');
      data[collectionName] = JSON.parse(localStorage.getItem(key) || '[]');
    }
  }

  return JSON.stringify(
    {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      data,
    },
    null,
    2
  );
}

// Import data from JSON file
export function importData(jsonString: string): { success: boolean; message: string } {
  try {
    const importData = JSON.parse(jsonString);

    if (!importData.data || typeof importData.data !== 'object') {
      return { success: false, message: 'Invalid data format' };
    }

    let importedCount = 0;

    for (const [collectionName, records] of Object.entries(importData.data)) {
      if (Array.isArray(records)) {
        const key = STORAGE_PREFIX + collectionName;
        localStorage.setItem(key, JSON.stringify(records));
        importedCount += records.length;
      }
    }

    return {
      success: true,
      message: `Successfully imported ${importedCount} records`,
    };
  } catch (e) {
    return {
      success: false,
      message: 'Failed to import: ' + (e instanceof Error ? e.message : 'Unknown error'),
    };
  }
}

// Download data as file
export function downloadData(): void {
  const data = exportAllData();
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `svarus-darbas-backup-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
