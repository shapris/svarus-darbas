/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type BuildingType = 'butas' | 'namas' | 'ofisas' | 'nesutarta';
export type OrderStatus = 'suplanuota' | 'vykdoma' | 'atlikta';

export interface Employee {
  id: string;
  name: string;
  phone: string;
  color: string;
  isActive: boolean;
  uid: string;
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  /** Neprivaloma — jei yra, sąskaitą galima siųsti per el. paštą. */
  email?: string;
  address: string;
  /** Jei DB turi stulpelius ir nustatyta per Google Places */
  lat?: number;
  lng?: number;
  buildingType: BuildingType;
  notes?: string;
  lastCleaningDate?: string;
  createdAt: string;
}

export interface Order {
  id: string;
  clientId: string;
  clientName: string;
  employeeId?: string;
  address: string;
  lat?: number;
  lng?: number;
  date: string;
  time: string;
  windowCount: number;
  floor: number;
  additionalServices: {
    balkonai: boolean;
    vitrinos: boolean;
    terasa: boolean;
    kiti: boolean;
  };
  totalPrice: number;
  status: OrderStatus;
  estimatedDuration?: number; // in minutes
  isRecurring?: boolean;
  recurringInterval?: number; // in months
  notes?: string;
  photoBefore?: string;
  photoAfter?: string;
  evaluation?: 'a1' | 'a2' | 'a3';
  isPaid?: boolean;
  /** Optional label for analytics / reporting (e.g. service category). */
  serviceType?: string;
  createdAt: string;
}

export interface Expense {
  id: string;
  title: string;
  amount: number;
  date: string;
  category: 'kuras' | 'priemonės' | 'reklama' | 'mokesčiai' | 'kita';
  notes?: string;
  uid: string;
}

export interface AppSettings {
  id?: string;
  pricePerWindow: number;
  pricePerFloor: number;
  priceBalkonai: number;
  priceVitrinos: number;
  priceTerasa: number;
  priceKiti: number;
  smsTemplate: string;
  /** Ar klientai gali rezervuoti per viešą /booking/{id} nuorodą. */
  publicBookingEnabled: boolean;
  /** server.cjs bazinis URL (pvz. http://127.0.0.1:3001) – saugomas naršyklėje automatinio sąskaitų siuntimo el. paštu keliui. */
  invoiceApiBaseUrl?: string;
}

export interface Memory {
  id: string;
  content: string;
  category: 'klientas' | 'verslas' | 'procesas' | 'kita';
  importance?: number;
  createdAt: string;
  uid: string;
  eventDate?: string;
  isActive?: boolean;
}

export interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  minQuantity: number;
  category: 'valikliai' | 'įrankiai' | 'kita';
  lastRestocked?: string;
  uid: string;
  created_at?: string;
  updated_at?: string;
}

export type UserRole = 'admin' | 'staff' | 'client';

export interface UserProfile {
  id: string;
  uid: string;
  email: string;
  role: UserRole;
  name?: string;
  phone?: string;
  clientId?: string;
  createdAt: string;
}

export interface ClientPortalAccess {
  id: string;
  clientId: string;
  email: string;
  passwordHash: string;
  lastLogin?: string;
  createdAt: string;
}

export interface Invoice {
  id: string;
  order_id: string;
  client_id: string;
  amount: number;
  status: 'pending' | 'paid' | 'cancelled' | 'refunded';
  due_date: string;
  created_at: string;
  paid_at?: string;
  stripe_payment_intent_id?: string;
  invoice_url?: string;
}

export interface Transaction {
  id: string;
  invoice_id?: string;
  payment_intent_id?: string;
  client_id: string;
  amount: number;
  currency: string;
  status: string;
  type: 'payment' | 'refund' | 'partial_refund';
  stripe_charge_id?: string;
  failure_reason?: string;
  created_at: string;
  processed_at?: string;
}

/** localStorage raktas – CRM API adresas sąskaitų el. paštu siuntimui (suderinamas su server.cjs). */
export const INVOICE_API_STORAGE_KEY = 'svarus_invoice_api_base_url';

export const DEFAULT_SETTINGS: AppSettings = {
  pricePerWindow: 5,
  pricePerFloor: 2,
  priceBalkonai: 15,
  priceVitrinos: 20,
  priceTerasa: 25,
  priceKiti: 10,
  smsTemplate:
    'Sveiki {vardas}, primename apie langų valymą {data} {laikas}. Kaina: {kaina}. Iki pasimatymo!',
  publicBookingEnabled: true,
  invoiceApiBaseUrl: '',
};
