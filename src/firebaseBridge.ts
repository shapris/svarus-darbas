/**
 * Google Firebase (Firestore + Auth) backend — alternative to Supabase.
 * Configure with VITE_USE_FIREBASE=true and the VITE_FIREBASE_* env vars.
 */

import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    GoogleAuthProvider,
    signInWithPopup,
    signOut as firebaseSignOut,
    updateProfile,
    onAuthStateChanged,
    type User as FirebaseUser,
} from 'firebase/auth';
import {
    getFirestore,
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    onSnapshot,
    addDoc,
    type DocumentData,
} from 'firebase/firestore';
import { DEFAULT_SETTINGS, type AppSettings } from './types';

export const TABLES_FB = {
    CLIENTS: 'clients',
    ORDERS: 'orders',
    EXPENSES: 'expenses',
    EMPLOYEES: 'employees',
    SETTINGS: 'settings',
    INVENTORY: 'inventory',
    MEMORIES: 'memories',
} as const;

let app: FirebaseApp | null = null;

function ensureApp(): FirebaseApp {
    if (app) return app;
    const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
    const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
    if (!apiKey || !projectId) {
        throw new Error('Trūksta Firebase konfigūracijos (VITE_FIREBASE_*).');
    }
    app = initializeApp({
        apiKey,
        authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || `${projectId}.firebaseapp.com`,
        projectId,
        storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || `${projectId}.appspot.com`,
        messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
        appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
    });
    return app;
}

export function getFirebaseAuth() {
    return getAuth(ensureApp());
}

export function getFirebaseDb() {
    return getFirestore(ensureApp());
}

function mapToAuthUser(u: FirebaseUser) {
    return {
        uid: u.uid,
        email: u.email || '',
        displayName: u.displayName || u.email?.split('@')[0] || null,
        photoURL: u.photoURL,
    };
}

function wrapUserForApp(u: FirebaseUser) {
    return {
        user: {
            id: u.uid,
            email: u.email,
            user_metadata: {
                display_name: u.displayName,
                avatar_url: u.photoURL,
            },
        },
        session: null,
    };
}

function mapAuthError(e: unknown): Error {
    const code = (e as { code?: string })?.code;
    const msg = e instanceof Error ? e.message : String(e);
    if (code === 'auth/email-already-in-use') return new Error('Vartotojas su tokiu el. paštu jau egzistuoja');
    if (code === 'auth/weak-password') return new Error('Slaptažodis per silpnas. Naudokite bent 6 simbolius.');
    if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/invalid-login-credentials') {
        return new Error('Neteisingas el. paštas arba slaptažodis');
    }
    if (code === 'auth/user-not-found') return new Error('Vartotojas su tokiu el. paštu nerastas');
    return new Error(msg || 'Autentifikacijos klaida');
}

function normalizeFirestoreDoc(id: string, data: DocumentData | undefined): Record<string, unknown> {
    if (!data) return { id };
    const out: Record<string, unknown> = { id, ...data };
    for (const k of Object.keys(out)) {
        const v = out[k];
        if (v && typeof v === 'object' && v !== null && 'toDate' in v && typeof (v as { toDate: () => Date }).toDate === 'function') {
            out[k] = (v as { toDate: () => Date }).toDate().toISOString();
        }
    }
    return out;
}

export async function signUp(email: string, password: string, displayName?: string) {
    try {
        const auth = getFirebaseAuth();
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        const name = displayName || email.split('@')[0];
        if (name) {
            await updateProfile(cred.user, { displayName: name });
        }
        return wrapUserForApp(cred.user);
    } catch (e) {
        throw mapAuthError(e);
    }
}

export async function signIn(email: string, password: string) {
    try {
        const auth = getFirebaseAuth();
        const cred = await signInWithEmailAndPassword(auth, email, password);
        return wrapUserForApp(cred.user);
    } catch (e) {
        throw mapAuthError(e);
    }
}

export async function signInWithGoogle() {
    try {
        const auth = getFirebaseAuth();
        const provider = new GoogleAuthProvider();
        const cred = await signInWithPopup(auth, provider);
        return wrapUserForApp(cred.user);
    } catch (e) {
        throw mapAuthError(e);
    }
}

export async function signOut() {
    await firebaseSignOut(getFirebaseAuth());
}

export async function getCurrentUser() {
    const auth = getFirebaseAuth();
    await auth.authStateReady();
    const u = auth.currentUser;
    return u ? mapToAuthUser(u) : null;
}

export function onAuthStateChange(callback: (user: ReturnType<typeof mapToAuthUser> | null) => void) {
    const auth = getFirebaseAuth();
    return onAuthStateChanged(auth, (u) => {
        callback(u ? mapToAuthUser(u) : null);
    });
}

export async function getData<T extends { id?: string }>(tableName: string, userId: string): Promise<T[]> {
    const db = getFirebaseDb();
    if (tableName === TABLES_FB.SETTINGS) {
        const snap = await getDoc(doc(db, TABLES_FB.SETTINGS, userId));
        if (!snap.exists()) return [];
        return [normalizeFirestoreDoc(userId, snap.data()) as T];
    }
    const q = query(collection(db, tableName), where('uid', '==', userId));
    const snap = await getDocs(q);
    const rows = snap.docs.map((d) => normalizeFirestoreDoc(d.id, d.data()) as T);
    rows.sort((a, b) => {
        const ca = String((a as { createdAt?: string }).createdAt || '');
        const cb = String((b as { createdAt?: string }).createdAt || '');
        return cb.localeCompare(ca);
    });
    return rows;
}

export async function getDataById<T extends { id?: string }>(tableName: string, id: string): Promise<T | null> {
    const db = getFirebaseDb();
    const snap = await getDoc(doc(db, tableName, id));
    if (!snap.exists()) return null;
    return normalizeFirestoreDoc(snap.id, snap.data()) as T;
}

export async function addData<T extends Record<string, unknown>>(
    tableName: string,
    userId: string,
    item: Omit<T, 'id' | 'uid' | 'created_at'>
): Promise<T> {
    const db = getFirebaseDb();
    const now = new Date().toISOString();
    const payload = { ...item, uid: userId, createdAt: (item as { createdAt?: string }).createdAt || now, updatedAt: now };

    if (tableName === TABLES_FB.SETTINGS) {
        const ref = doc(db, TABLES_FB.SETTINGS, userId);
        await setDoc(ref, { ...payload, id: userId }, { merge: true });
        const snap = await getDoc(ref);
        return normalizeFirestoreDoc(userId, snap.data()) as T;
    }

    const col = collection(db, tableName);
    const ref = await addDoc(col, payload);
    const snap = await getDoc(ref);
    return normalizeFirestoreDoc(ref.id, snap.data()) as T;
}

export async function updateData<T extends Record<string, unknown>>(tableName: string, id: string, updates: Partial<T>) {
    const db = getFirebaseDb();
    const now = new Date().toISOString();
    await updateDoc(doc(db, tableName, id), {
        ...updates,
        updatedAt: now,
    } as Record<string, unknown>);
}

export async function deleteData(tableName: string, id: string) {
    const db = getFirebaseDb();
    await deleteDoc(doc(db, tableName, id));
}

export function subscribeToData<T extends { id?: string }>(
    tableName: string,
    userId: string,
    callback: (data: T[]) => void
): () => void {
    const db = getFirebaseDb();
    if (tableName === TABLES_FB.SETTINGS) {
        return onSnapshot(doc(db, TABLES_FB.SETTINGS, userId), (snap) => {
            callback((snap.exists() ? [normalizeFirestoreDoc(userId, snap.data()) as T] : []) as T[]);
        });
    }
    const q = query(collection(db, tableName), where('uid', '==', userId));
    return onSnapshot(q, (snap) => {
        const rows = snap.docs.map((d) => normalizeFirestoreDoc(d.id, d.data()) as T);
        rows.sort((a, b) => {
            const ca = String((a as { createdAt?: string }).createdAt || '');
            const cb = String((b as { createdAt?: string }).createdAt || '');
            return cb.localeCompare(ca);
        });
        callback(rows);
    });
}

export async function fetchPublicBookingSettings(ownerUid: string): Promise<AppSettings> {
    const db = getFirebaseDb();
    const snap = await getDoc(doc(db, TABLES_FB.SETTINGS, ownerUid));
    if (!snap.exists()) return { ...DEFAULT_SETTINGS };
    const raw = normalizeFirestoreDoc(ownerUid, snap.data()) as Record<string, unknown>;
    const num = (v: unknown, fallback: number) => {
        if (typeof v === 'number' && !Number.isNaN(v)) return v;
        const p = parseFloat(String(v ?? ''));
        return Number.isFinite(p) ? p : fallback;
    };
    return {
        ...DEFAULT_SETTINGS,
        pricePerWindow: num(raw.pricePerWindow, DEFAULT_SETTINGS.pricePerWindow),
        pricePerFloor: num(raw.pricePerFloor, DEFAULT_SETTINGS.pricePerFloor),
        priceBalkonai: num(raw.priceBalkonai, DEFAULT_SETTINGS.priceBalkonai),
        priceVitrinos: num(raw.priceVitrinos, DEFAULT_SETTINGS.priceVitrinos),
        priceTerasa: num(raw.priceTerasa, DEFAULT_SETTINGS.priceTerasa),
        priceKiti: num(raw.priceKiti, DEFAULT_SETTINGS.priceKiti),
        smsTemplate: typeof raw.smsTemplate === 'string' ? raw.smsTemplate : DEFAULT_SETTINGS.smsTemplate,
    };
}

export async function submitPublicBooking(
    ownerUid: string,
    clientPayload: Record<string, unknown>,
    orderPayload: Record<string, unknown>
): Promise<void> {
    const db = getFirebaseDb();
    const settingsSnap = await getDoc(doc(db, TABLES_FB.SETTINGS, ownerUid));
    if (!settingsSnap.exists()) {
        const err = new Error('invalid_booking_owner');
        throw err;
    }
    const phone = String(clientPayload.phone || '').trim();
    if (phone.length < 5) {
        throw new Error('invalid_phone');
    }
    const clientsCol = collection(db, TABLES_FB.CLIENTS);
    const q = query(clientsCol, where('uid', '==', ownerUid), where('phone', '==', phone));
    const found = await getDocs(q);
    let clientId: string;
    if (!found.empty) {
        clientId = found.docs[0].id;
    } else {
        const ref = await addDoc(clientsCol, {
            uid: ownerUid,
            name: clientPayload.name || '',
            phone,
            address: clientPayload.address || '',
            buildingType: clientPayload.buildingType || 'butas',
            createdAt: clientPayload.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        });
        clientId = ref.id;
    }
    await addDoc(collection(db, TABLES_FB.ORDERS), {
        uid: ownerUid,
        clientId,
        clientName: orderPayload.clientName || '',
        address: orderPayload.address || '',
        lat: orderPayload.lat ?? null,
        lng: orderPayload.lng ?? null,
        date: orderPayload.date || '',
        time: orderPayload.time || '',
        windowCount: orderPayload.windowCount ?? 0,
        floor: orderPayload.floor ?? 0,
        additionalServices: orderPayload.additionalServices || {},
        totalPrice: orderPayload.totalPrice ?? 0,
        status: orderPayload.status || 'suplanuota',
        notes: orderPayload.notes || '',
        createdAt: orderPayload.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    });
}

export async function testConnection() {
    try {
        ensureApp();
        return true;
    } catch {
        return false;
    }
}
