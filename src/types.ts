/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type BuildingType = 'butas' | 'namas' | 'ofisas';
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
  address: string;
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

export const DEFAULT_SETTINGS: AppSettings = {
  pricePerWindow: 5,
  pricePerFloor: 2,
  priceBalkonai: 15,
  priceVitrinos: 20,
  priceTerasa: 25,
  priceKiti: 10,
  smsTemplate: "Sveiki {vardas}, primename apie langų valymą {data} {laikas}. Kaina: {kaina}. Iki pasimatymo!",
};
