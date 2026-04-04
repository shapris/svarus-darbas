/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Order, Client, AppSettings } from '../types';

export interface SMSTemplate {
  id: string;
  name: string;
  template: string;
  description: string;
}

export const SMS_TEMPLATES: SMSTemplate[] = [
  {
    id: 'reminder_24h',
    name: 'Priminimas prieš 24 valandas',
    template:
      'Sveiki {vardas}, primename apie langų valymą {data} {laikas}. Adresas: {adresas}. Kaina: {kaina}. Iki pasimatymo!',
    description: 'Siunčiama 24h prieš valymą',
  },
  {
    id: 'reminder_1h',
    name: 'Priminimas prieš 1 valandą',
    template:
      'Sveiki {vardas}, langų valymas prasideda po valandos! {data} {laikas}. Adresas: {adresas}. Laukiame jus!',
    description: 'Siunčiama 1h prieš valymą',
  },
  {
    id: 'thank_you',
    name: 'Ačiū už paslaugą',
    template:
      'Sveiki {vardas}, ačiū, kad pasirinkote mūsų paslaugas! Laukiame grįžtant. Atsiliepimus galite palikti: {atsiliepimu_linkas}',
    description: 'Siunčiama po atliktų darbų',
  },
  {
    id: 'payment_reminder',
    name: 'Mokėjimo priminimas',
    template:
      'Sveiki {vardas}, primename apie neapmokėtą sąskaitą už langų valymą {data}. Suma: {kaina}. Mokėjimo informacija: {mokejimo_info}',
    description: 'Siunčiama vėluojantiems mokėjimams',
  },
];

export interface SMSReminder {
  id: string;
  orderId: string;
  clientId: string;
  type: '24h' | '1h' | 'thank_you' | 'payment';
  scheduledFor: Date;
  sent: boolean;
  sentAt?: Date;
}

export class SMSService {
  private static instance: SMSService;
  private reminders: SMSReminder[] = [];

  static getInstance(): SMSService {
    if (!SMSService.instance) {
      SMSService.instance = new SMSService();
    }
    return SMSService.instance;
  }

  // Generate personalized SMS
  generateSMS(template: SMSTemplate, order: Order, client: Client, settings: AppSettings): string {
    let sms = template.template;

    // Replace placeholders
    sms = sms.replace('{vardas}', client.name);
    sms = sms.replace('{data}', order.date);
    sms = sms.replace('{laikas}', order.time);
    sms = sms.replace('{adresas}', order.address);
    sms = sms.replace('{kaina}', this.formatPrice(order.totalPrice));
    sms = sms.replace('{atsiliepimu_linkas}', 'https://g.page/r/your-google-review-link/review');
    sms = sms.replace('{mokejimo_info}', (settings as any).paymentInfo || 'Banko pavedimu');

    return sms;
  }

  // Send SMS via device
  sendSMS(phoneNumber: string, message: string): void {
    // Open SMS app with pre-filled message
    const smsUrl = `sms:${phoneNumber}?body=${encodeURIComponent(message)}`;
    window.open(smsUrl, '_blank');
  }

  // Schedule reminders for an order
  scheduleReminders(order: Order, client: Client, settings: AppSettings): SMSReminder[] {
    const reminders: SMSReminder[] = [];
    const orderDate = new Date(`${order.date}T${order.time}`);

    // 24h before reminder
    const reminder24h = new Date(orderDate.getTime() - 24 * 60 * 60 * 1000);
    if (reminder24h > new Date()) {
      reminders.push({
        id: `24h_${order.id}`,
        orderId: order.id,
        clientId: client.id,
        type: '24h',
        scheduledFor: reminder24h,
        sent: false,
      });
    }

    // 1h before reminder
    const reminder1h = new Date(orderDate.getTime() - 60 * 60 * 1000);
    if (reminder1h > new Date()) {
      reminders.push({
        id: `1h_${order.id}`,
        orderId: order.id,
        clientId: client.id,
        type: '1h',
        scheduledFor: reminder1h,
        sent: false,
      });
    }

    // Thank you message (after completion)
    if (order.status === 'atlikta') {
      const thankYouTime = new Date(orderDate.getTime() + 2 * 60 * 60 * 1000); // 2h after
      reminders.push({
        id: `thank_${order.id}`,
        orderId: order.id,
        clientId: client.id,
        type: 'thank_you',
        scheduledFor: thankYouTime,
        sent: false,
      });
    }

    this.reminders.push(...reminders);
    return reminders;
  }

  // Check and send pending reminders
  checkPendingReminders(orders: Order[], clients: Client[], settings: AppSettings): void {
    const now = new Date();

    this.reminders.forEach((reminder) => {
      if (!reminder.sent && reminder.scheduledFor <= now) {
        const order = orders.find((o) => o.id === reminder.orderId);
        const client = clients.find((c) => c.id === reminder.clientId);

        if (order && client && client.phone) {
          const template =
            SMS_TEMPLATES.find((t) => t.id === `${reminder.type}_reminder`) ||
            SMS_TEMPLATES.find((t) => t.id === reminder.type);

          if (template) {
            const message = this.generateSMS(template, order, client, settings);
            this.sendSMS(client.phone, message);

            // Mark as sent
            reminder.sent = true;
            reminder.sentAt = now;

            // Store in localStorage for persistence
            this.saveReminders();
          }
        }
      }
    });
  }

  // Get pending reminders count
  getPendingRemindersCount(): number {
    const now = new Date();
    return this.reminders.filter((r) => !r.sent && r.scheduledFor > now).length;
  }

  // Get today's reminders
  getTodaysReminders(): SMSReminder[] {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    return this.reminders.filter((r) => r.scheduledFor >= startOfDay && r.scheduledFor < endOfDay);
  }

  // Manual send reminder
  sendManualReminder(
    orderId: string,
    type: '24h' | '1h' | 'thank_you' | 'payment',
    orders: Order[],
    clients: Client[],
    settings: AppSettings
  ): void {
    const order = orders.find((o) => o.id === orderId);
    const client = clients.find((c) => c.id === order?.clientId);

    if (order && client && client.phone) {
      const template =
        SMS_TEMPLATES.find((t) => t.id === `${type}_reminder`) ||
        SMS_TEMPLATES.find((t) => t.id === type);

      if (template) {
        const message = this.generateSMS(template, order, client, settings);
        this.sendSMS(client.phone, message);
      }
    }
  }

  // Save reminders to localStorage
  private saveReminders(): void {
    try {
      localStorage.setItem('sms_reminders', JSON.stringify(this.reminders));
    } catch (error) {
      console.warn('Failed to save SMS reminders:', error);
    }
  }

  // Load reminders from localStorage
  loadReminders(): void {
    try {
      const saved = localStorage.getItem('sms_reminders');
      if (saved) {
        this.reminders = JSON.parse(saved).map((r: any) => ({
          ...r,
          scheduledFor: new Date(r.scheduledFor),
          sentAt: r.sentAt ? new Date(r.sentAt) : undefined,
        }));
      }
    } catch (error) {
      console.warn('Failed to load SMS reminders:', error);
      this.reminders = [];
    }
  }

  // Clear old reminders
  clearOldReminders(): void {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    this.reminders = this.reminders.filter((r) => r.scheduledFor > oneWeekAgo);
    this.saveReminders();
  }

  private formatPrice(amount: number): string {
    return new Intl.NumberFormat('lt-LT', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  }

  // Get reminder statistics
  getReminderStats(): {
    total: number;
    sent: number;
    pending: number;
    overdue: number;
  } {
    const now = new Date();

    return {
      total: this.reminders.length,
      sent: this.reminders.filter((r) => r.sent).length,
      pending: this.reminders.filter((r) => !r.sent && r.scheduledFor > now).length,
      overdue: this.reminders.filter((r) => !r.sent && r.scheduledFor <= now).length,
    };
  }
}

export const smsService = SMSService.getInstance();
