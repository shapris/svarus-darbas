import type { Dispatch, SetStateAction } from 'react';
import { addData, updateData, deleteData, getData, TABLES } from '../../supabase';
import { calculateOrderPrice } from '../../utils';
import type { Client, Order, Expense, AppSettings, Memory, InventoryItem } from '../../types';
import { logDevError } from '../../utils/devConsole';
import type { AssistantToolCall } from './types';

type AssistantToolArgs = {
  [key: string]: unknown;
  name?: string;
  phone?: string;
  address?: string;
  buildingType?: string;
  notes?: string;
  city?: string;
  placeName?: string;
  country?: string;
  clientId?: string;
  clientName?: string;
  date?: string;
  time?: string;
  windowCount?: number;
  floor?: number;
  estimatedDuration?: number;
  totalPrice?: number;
  orderId?: string;
  ordersIds?: string[];
  status?: string;
  title?: string;
  amount?: number;
  category?: Expense['category'];
  expenseId?: string;
  memoryId?: string;
  content?: string;
  days?: number;
  period?: 'week' | 'month' | 'year';
  months?: number;
  limit?: number;
  by?: 'orders' | 'revenue';
  intervalMonths?: number;
  orderIds?: string[];
  additionalServices?: {
    balkonai?: boolean;
    vitrinos?: boolean;
    terasa?: boolean;
    kiti?: boolean;
  };
};

export type AssistantToolHandlerContext = {
  user: { uid: string };
  /** CRM owner_id (įmonės workspace) */
  dataOwnerId: string;
  clients: Client[];
  orders: Order[];
  expenses: Expense[];
  settings: AppSettings;
  isRestrictedStaff: boolean;
  setMemories: Dispatch<SetStateAction<Memory[]>>;
};

export async function runAssistantToolCall(
  call: unknown,
  ctx: AssistantToolHandlerContext
): Promise<string> {
  const { dataOwnerId, clients, orders, expenses, settings, isRestrictedStaff, setMemories } = ctx;

  if (!call || typeof call !== 'object' || !('name' in call)) {
    return 'Neteisingas įrankio kvietimas.';
  }
  const { name, args: rawArgs } = call as AssistantToolCall;
  if (typeof name !== 'string') {
    return 'Neteisingas įrankio kvietimas.';
  }
  const args = (
    rawArgs && typeof rawArgs === 'object' && !Array.isArray(rawArgs) ? rawArgs : {}
  ) as AssistantToolArgs;

  if (isRestrictedStaff && name.startsWith('delete_')) {
    return 'Šį veiksmą gali atlikti tik administratorius.';
  }

  try {
    if (name === 'add_client') {
      await addData(TABLES.CLIENTS, dataOwnerId, {
        name: args.name || 'Naujas klientas',
        phone: args.phone || 'nesutarta',
        address: args.address || 'nesutarta',
        buildingType: args.buildingType || 'nesutarta',
        notes: args.notes || '',
        createdAt: new Date().toISOString(),
      });
      return `Klientas ${args.name || 'Naujas klientas'} sėkmingai pridėtas.`;
    }

    if (name === 'geocode_address') {
      const { city, placeName, country } = args;
      try {
        const fullAddress = `${placeName}, ${city}${country ? ', ' + country : ', Lietuva'}`;
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullAddress)}`,
          {
            headers: {
              Accept: 'application/json',
              'Accept-Language': 'lt,en',
              // OSM naudojimo politika — identifikuojame aplikaciją (žr. docs/NOMINATIM_GEOCODING.md)
              'User-Agent': 'SvarusDarbas-CRM/1.0 (+https://github.com/shapris/svarus-darbas)',
            },
          }
        );
        const data = await response.json();

        if (data && data.length > 0) {
          const result = data[0];
          return JSON.stringify({
            success: true,
            address: result.display_name,
            lat: parseFloat(result.lat),
            lng: parseFloat(result.lon),
          });
        }
        return JSON.stringify({ success: false, error: 'Adresas nerastas' });
      } catch {
        return JSON.stringify({ success: false, error: 'Klaida ieškant adreso' });
      }
    }

    if (name === 'update_client') {
      const { clientId, ...updates } = args;
      await updateData(TABLES.CLIENTS, clientId, updates as Partial<Client>);
      return `Kliento duomenys atnaujinti.`;
    }

    if (name === 'delete_client') {
      await deleteData(TABLES.CLIENTS, args.clientId);
      return `Klientas ištrintas.`;
    }

    if (name === 'add_order') {
      const clientName = args.clientName || '';
      const client = clients.find((c) =>
        (c.name || '').toLowerCase().includes(clientName.toLowerCase())
      );
      if (!client)
        return `Klaida: Klientas "${clientName}" nerastas. Pirmiausia pridėkite klientą.`;

      const additionalServices = {
        balkonai: args.additionalServices?.balkonai || false,
        vitrinos: args.additionalServices?.vitrinos || false,
        terasa: args.additionalServices?.terasa || false,
        kiti: args.additionalServices?.kiti || false,
      };

      const totalPrice = calculateOrderPrice(
        args.windowCount || 0,
        args.floor || 0,
        additionalServices,
        settings
      );

      await addData(TABLES.ORDERS, dataOwnerId, {
        clientId: client.id,
        clientName: client.name,
        address: args.address || client.address || 'nesutarta',
        date: args.date || 'nesutarta',
        time: args.time || 'nesutarta',
        windowCount: args.windowCount || 0,
        floor: args.floor || 0,
        estimatedDuration: args.estimatedDuration || 0,
        additionalServices,
        totalPrice,
        status: 'suplanuota',
        notes: args.notes || '',
        createdAt: new Date().toISOString(),
      });
      return `Užsakymas klientui ${client.name} sėkmingai sukurtas.`;
    }

    if (name === 'update_order') {
      const { orderId, ...updates } = args;
      const existingOrder = orders.find((o) => o.id === orderId);

      if (
        existingOrder &&
        (updates.windowCount !== undefined ||
          updates.floor !== undefined ||
          updates.additionalServices !== undefined)
      ) {
        const newWindowCount = updates.windowCount ?? existingOrder.windowCount;
        const newFloor = updates.floor ?? existingOrder.floor;
        const newServices = {
          ...existingOrder.additionalServices,
          ...(updates.additionalServices || {}),
        };

        if (updates.totalPrice === undefined) {
          updates.totalPrice = calculateOrderPrice(newWindowCount, newFloor, newServices, settings);
        }
        updates.additionalServices = newServices;
      }

      await updateData(TABLES.ORDERS, orderId, updates as Partial<Order>);
      return `Užsakymas atnaujintas.`;
    }

    if (name === 'delete_order') {
      await deleteData(TABLES.ORDERS, args.orderId);
      return `Užsakymas ištrintas.`;
    }

    if (name === 'add_expense') {
      await addData('expenses', dataOwnerId, {
        title: args.title || 'nesutarta',
        amount: args.amount || 0,
        date: args.date || 'nesutarta',
        category: args.category || 'kita',
        notes: args.notes || '',
        createdAt: new Date().toISOString(),
      });
      return `Išlaidos "${args.title || 'nesutarta'}" užregistruotos.`;
    }

    if (name === 'update_expense') {
      const { expenseId, ...updates } = args;
      await updateData('expenses', expenseId, updates);
      return `Išlaidų įrašas atnaujintas.`;
    }

    if (name === 'delete_expense') {
      await deleteData('expenses', args.expenseId);
      return `Išlaidų įrašas ištrintas.`;
    }

    if (name === 'add_memory') {
      await addData('memories', dataOwnerId, {
        ...args,
        createdAt: new Date().toISOString(),
      });
      const freshMemories = await getData<Memory>('memories', dataOwnerId);
      setMemories(freshMemories);
      return `Informacija įsiminta: "${args.content}"`;
    }

    if (name === 'update_memory') {
      const { memoryId, ...updates } = args;
      await updateData('memories', memoryId, updates);
      const freshMemories = await getData<Memory>('memories', dataOwnerId);
      setMemories(freshMemories);
      return `Atmintis atnaujinta.`;
    }

    if (name === 'delete_memory') {
      await deleteData('memories', args.memoryId);
      const freshMemories = await getData<Memory>('memories', dataOwnerId);
      setMemories(freshMemories);
      return `Atmintis ištrinta.`;
    }

    if (name === 'get_neglected_clients') {
      const days = args.days || 90;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      const cutoffStr = cutoffDate.toISOString().split('T')[0];

      const neglected = clients.filter((client) => {
        const clientOrders = orders.filter((o) => o.clientId === client.id);
        const lastOrder = clientOrders.sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        )[0];
        return !lastOrder || lastOrder.date < cutoffStr;
      });

      return `Rasta ${neglected.length} klientų, neaplankytų per ${days} dienų: ${neglected.map((c) => c.name).join(', ') || 'nėra'}`;
    }

    if (name === 'get_low_inventory') {
      try {
        const items = await getData<InventoryItem>(TABLES.INVENTORY, dataOwnerId);
        const low = items.filter((i) => Number(i.quantity) < Number(i.minQuantity));
        if (low.length === 0) {
          return `Inventorius: žemiau minimalios ribos prekių nėra (iš viso ${items.length} pozicijų).`;
        }
        const lines = low
          .slice(0, 25)
          .map(
            (i) =>
              `• ${i.name}: likutis ${i.quantity} ${i.unit}, minimumas ${i.minQuantity} ${i.unit} (${i.category})`
          );
        const more = low.length > 25 ? `\n… ir dar ${low.length - 25} poz.` : '';
        return `Žemiau minimalios ribos (${low.length}):\n${lines.join('\n')}${more}`;
      } catch (e) {
        logDevError('get_low_inventory', e);
        return 'Nepavyko nuskaityti inventoriaus. Patikrinkite ryšį arba atverkite skiltį „Daugiau → Inventorius“.';
      }
    }

    if (name === 'get_unpaid_orders') {
      /** Atlikti dar nepažymėti kaip apmokėti CRM (`isPaid !== true`, įsk. senus įrašus be žymės). */
      const unpaid = orders.filter((o) => o.status === 'atlikta' && o.isPaid !== true);
      const total = unpaid.reduce((sum, o) => sum + o.totalPrice, 0);
      return (
        `Atlikti, bet CRM dar nepažymėti kaip apmokėti: ${unpaid.length} užsakymų. ` +
        `Bendra suma: ${total.toFixed(2)} €. ` +
        `(Jei sąskaita jau apmokėta — pažymėkite užsakyme „apmokėta“.)`
      );
    }

    if (name === 'get_business_summary') {
      const period = args.period || 'month';
      const now = new Date();
      const startDate = new Date();

      if (period === 'week') startDate.setDate(now.getDate() - 7);
      else if (period === 'month') startDate.setMonth(now.getMonth() - 1);
      else startDate.setFullYear(now.getFullYear() - 1);

      const startStr = startDate.toISOString().split('T')[0];
      const periodOrders = orders.filter((o) => o.date >= startStr);
      const periodExpenses = expenses.filter((e) => e.date >= startStr);

      const revenue = periodOrders
        .filter((o) => o.status === 'atlikta')
        .reduce((sum, o) => sum + o.totalPrice, 0);
      const totalExp = periodExpenses.reduce((sum, e) => sum + e.amount, 0);

      return `📊 **Verslo suvestinė (${period}):**\n- Užsakymų: ${periodOrders.length}\n- Pajamos: ${revenue}€\n- Išlaidos: ${totalExp}€\n- Pelnas: ${revenue - totalExp}€`;
    }

    if (name === 'get_top_clients') {
      const limit = args.limit || 5;
      const by = args.by || 'orders';

      const clientStats: Record<string, { name: string; orders: number; revenue: number }> = {};

      orders
        .filter((o) => o.status === 'atlikta')
        .forEach((o) => {
          if (!clientStats[o.clientId]) {
            clientStats[o.clientId] = { name: o.clientName, orders: 0, revenue: 0 };
          }
          clientStats[o.clientId].orders++;
          clientStats[o.clientId].revenue += o.totalPrice;
        });

      const sorted = Object.values(clientStats)
        .sort((a, b) => (by === 'revenue' ? b.revenue - a.revenue : b.orders - a.orders))
        .slice(0, limit);

      return (
        `🏆 **Top ${limit} klientai (pagal ${by}):**\n` +
        sorted.map((c, i) => `${i + 1}. ${c.name}: ${c.orders} užs., ${c.revenue}€`).join('\n')
      );
    }

    if (name === 'get_revenue_trends') {
      const months = args.months || 6;
      const now = new Date();
      const trends: string[] = [];

      for (let i = months - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthStr = d.toISOString().slice(0, 7);
        const monthOrders = orders.filter(
          (o) => o.date.startsWith(monthStr) && o.status === 'atlikta'
        );
        const revenue = monthOrders.reduce((sum, o) => sum + o.totalPrice, 0);
        const monthName = d.toLocaleString('lt-LT', { month: 'short' });
        trends.push(`${monthName}: ${revenue}€`);
      }

      return `📈 **Pajamų tendencijos (${months} mėn.):**\n` + trends.join('\n');
    }

    if (name === 'create_recurring_order') {
      const clientName = args.clientName || '';
      const client = clients.find((c) =>
        (c.name || '').toLowerCase().includes(clientName.toLowerCase())
      );
      if (!client) return `Klaida: Klientas "${clientName}" nerastas.`;

      const additionalServices = {
        balkonai: args.additionalServices?.balkonai || false,
        vitrinos: args.additionalServices?.vitrinos || false,
        terasa: args.additionalServices?.terasa || false,
        kiti: args.additionalServices?.kiti || false,
      };

      const totalPrice = calculateOrderPrice(
        args.windowCount,
        args.floor,
        additionalServices,
        settings
      );

      await addData(TABLES.ORDERS, dataOwnerId, {
        clientId: client.id,
        clientName: client.name,
        address: args.address,
        date: args.date,
        time: args.time,
        windowCount: args.windowCount,
        floor: args.floor,
        estimatedDuration: args.estimatedDuration || 60,
        additionalServices,
        totalPrice,
        status: 'suplanuota',
        isRecurring: true,
        recurringInterval: args.intervalMonths,
        notes: `Kartotinis užs kas ${args.intervalMonths} mėn.`,
        createdAt: new Date().toISOString(),
      });

      return `🔄 Kartotinis užsakymas sukurtas klientui ${client.name} kas ${args.intervalMonths} mėnesį!`;
    }

    if (name === 'generate_reminder_message') {
      const order = orders.find((o) => o.id === args.orderId);
      if (!order) return `Užsakymas nerastas.`;

      const client = clients.find((c) => c.id === order.clientId);
      const message = settings.smsTemplate
        .replace('{vardas}', client?.name || 'kliente')
        .replace('{data}', order.date)
        .replace('{laikas}', order.time)
        .replace('{kaina}', order.totalPrice + '€');

      return `📱 **Priminimo žinutė:**\n${message}`;
    }

    if (name === 'batch_update_order_status') {
      const rawIds = args.orderIds;
      const orderIds = Array.isArray(rawIds)
        ? rawIds.filter((id): id is string => typeof id === 'string' && id.length > 0)
        : [];
      const status = args.status;
      if (orderIds.length === 0 || typeof status !== 'string') {
        return 'Neteisingi parametrai: reikia orderIds (ne tuščias stringų masyvas) ir status (tekstas).';
      }
      await Promise.all(orderIds.map((orderId) => updateData(TABLES.ORDERS, orderId, { status })));
      return `✅ ${orderIds.length} užsakymų būsena pakeista į "${status}".`;
    }
  } catch (error) {
    logDevError('Tool execution error:', error);
    return `Klaida vykdant veiksmą: ${error instanceof Error ? error.message : 'techninė klaida be papildomos žinutės — bandykite dar kartą arba kitą komandą'}`;
  }
  return 'Nežinomas veiksmas — patikrinkite, ar komanda palaikoma, ir bandykite dar kartą.';
}
