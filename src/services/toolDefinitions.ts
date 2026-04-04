// Tool definitions for AI assistant function calling
import { Type, FunctionDeclaration } from '@google/genai';

export const addClientTool: FunctionDeclaration = {
  name: 'add_client',
  parameters: {
    type: Type.OBJECT,
    description:
      'Pridėti naują klientą į sistemą. Galiu AUTOMATIŠKAI rasti adresą jei žinote miestą ir vietos pavadinimą! Visi laukai nebūtini - svarbu išsaugoti klientą.',
    properties: {
      name: { type: Type.STRING, description: 'Kliento vardas ir pavardė arba įmonės pavadinimas' },
      phone: {
        type: Type.STRING,
        description: 'Telefono numeris (nebūtinas - galima pridėti vėliau)',
      },
      address: {
        type: Type.STRING,
        description: 'Adresas (jei žinote tik miestą + vietą, bus konvertuota automatiškai)',
      },
      buildingType: {
        type: Type.STRING,
        enum: ['butas', 'namas', 'ofisas', 'nesutarta'],
        description:
          'Pastato tipas. Jei nežinoma ar nenorite klausti — visada naudokite "nesutarta" ir išsaugokite klientą.',
      },
      notes: { type: Type.STRING, description: 'Papildomos pastabos apie klientą' },
    },
    required: [],
  },
};

export const geocodeAddressTool: FunctionDeclaration = {
  name: 'geocode_address',
  parameters: {
    type: Type.OBJECT,
    description:
      'Rasti adreso koordinates (GPS) naudojant miestą ir vietos pavadinimą. Naudinga kai žinote tik miestą ir parduotuvės/pavadinimą.',
    properties: {
      city: { type: Type.STRING, description: 'Miestas (pvz. Klaipėda, Rietavas)' },
      placeName: {
        type: Type.STRING,
        description: 'Vietos pavadinimas (pvz. Tūzas, Maxima, Vatušių gatvė)',
      },
      country: { type: Type.STRING, description: 'Šalis (numatytas Lietuva)' },
    },
    required: ['city', 'placeName'],
  },
};

export const addOrderTool: FunctionDeclaration = {
  name: 'add_order',
  parameters: {
    type: Type.OBJECT,
    description:
      'Sukurti naują užsakymą klientui. Visi laukai NEPRIVALOMI - svarbu išsaugoti užsakymą! Galiu AUTOMATIŠKAI rasti adreso koordinates jei žinote miestą ir vietos pavadinimą!',
    properties: {
      clientName: { type: Type.STRING, description: 'Kliento vardas (iš esamų klientų sąrašo)' },
      address: {
        type: Type.STRING,
        description: 'Valymo adresas (jei žinote tik miestą + vietą, bus rasta automatiškai)',
      },
      date: { type: Type.STRING, description: 'Data (YYYY-MM-DD)' },
      time: { type: Type.STRING, description: 'Laikas (HH:MM)' },
      windowCount: { type: Type.NUMBER, description: 'Langų kiekis' },
      floor: { type: Type.NUMBER, description: 'Aukštas' },
      estimatedDuration: {
        type: Type.NUMBER,
        description: 'Apytikslė trukmė bendromis minutėmis (pvz. 1 valanda = 60, 1 diena = 1440)',
      },
      notes: { type: Type.STRING, description: 'Užsakymo pastabos' },
      additionalServices: {
        type: Type.OBJECT,
        description: 'Papildomos paslaugos',
        properties: {
          balkonai: { type: Type.BOOLEAN, description: 'Balkonų valymas' },
          vitrinos: { type: Type.BOOLEAN, description: 'Vitrinų valymas' },
          terasa: { type: Type.BOOLEAN, description: 'Terasos valymas' },
          kiti: { type: Type.BOOLEAN, description: 'Kitos paslaugos' },
        },
      },
    },
    required: [],
  },
};

export const addExpenseTool: FunctionDeclaration = {
  name: 'add_expense',
  parameters: {
    type: Type.OBJECT,
    description:
      'Užregistruoti verslo išlaidas. Visi laukai NEPRIVALOMI - svarbu išsaugoti išlaidą!',
    properties: {
      title: { type: Type.STRING, description: 'Išlaidų pavadinimas (pvz. Kuras)' },
      amount: { type: Type.NUMBER, description: 'Suma eurais' },
      date: { type: Type.STRING, description: 'Data (YYYY-MM-DD)' },
      category: {
        type: Type.STRING,
        enum: ['kuras', 'priemonės', 'reklama', 'kita'],
        description: 'Kategori',
      },
      notes: { type: Type.STRING, description: 'Papildomos pastabos apie išlaidas' },
    },
    required: [],
  },
};

export const updateOrderTool: FunctionDeclaration = {
  name: 'update_order',
  parameters: {
    type: Type.OBJECT,
    description:
      'Atnaujinti esamą užsakymą. Visi laukai NEPRIVALOMI - svarbu išsaugoti pakeitimus!',
    properties: {
      orderId: { type: Type.STRING, description: 'Užsakymo ID' },
      status: {
        type: Type.STRING,
        enum: ['suplanuota', 'vykdoma', 'atlikta'],
        description: 'Nauja būsena',
      },
      notes: { type: Type.STRING, description: 'Naujos pastabos' },
      totalPrice: { type: Type.NUMBER, description: 'Nauja kaina' },
      address: { type: Type.STRING, description: 'Naujas adresas' },
      date: { type: Type.STRING, description: 'Nauja data (YYYY-MM-DD)' },
      time: { type: Type.STRING, description: 'Naujas laikas (HH:MM)' },
      windowCount: { type: Type.NUMBER, description: 'Naujas langų kiekis' },
      floor: { type: Type.NUMBER, description: 'Naujas aukštas' },
      estimatedDuration: {
        type: Type.NUMBER,
        description:
          'Nauja apytikslė trukmė bendromis minutėmis (pvz. 1 valanda = 60, 1 diena = 1440)',
      },
      additionalServices: {
        type: Type.OBJECT,
        description: 'Atnaujintos papildomos paslaugos',
        properties: {
          balkonai: { type: Type.BOOLEAN },
          vitrinos: { type: Type.BOOLEAN },
          terasa: { type: Type.BOOLEAN },
          kiti: { type: Type.BOOLEAN },
        },
      },
    },
    required: [],
  },
};

export const deleteOrderTool: FunctionDeclaration = {
  name: 'delete_order',
  parameters: {
    type: Type.OBJECT,
    description: 'Ištrinti užsakymą.',
    properties: {
      orderId: { type: Type.STRING, description: 'Užsakymo ID' },
    },
    required: ['orderId'],
  },
};

export const updateClientTool: FunctionDeclaration = {
  name: 'update_client',
  parameters: {
    type: Type.OBJECT,
    description: 'Atnaujinti kliento informaciją.',
    properties: {
      clientId: { type: Type.STRING, description: 'Kliento ID' },
      name: { type: Type.STRING, description: 'Naujas vardas' },
      phone: { type: Type.STRING, description: 'Naujas telefonas' },
      address: { type: Type.STRING, description: 'Naujas adresas' },
      notes: { type: Type.STRING, description: 'Naujos pastabos' },
      buildingType: {
        type: Type.STRING,
        enum: ['butas', 'namas', 'ofisas', 'nesutarta'],
        description: 'Naujas pastato tipas (nebūtina — galima nesutarta)',
      },
    },
    required: ['clientId'],
  },
};

export const deleteClientTool: FunctionDeclaration = {
  name: 'delete_client',
  parameters: {
    type: Type.OBJECT,
    description: 'Ištrinti klientą.',
    properties: {
      clientId: { type: Type.STRING, description: 'Kliento ID' },
    },
    required: ['clientId'],
  },
};

export const updateExpenseTool: FunctionDeclaration = {
  name: 'update_expense',
  parameters: {
    type: Type.OBJECT,
    description: 'Atnaujinti išlaidas.',
    properties: {
      expenseId: { type: Type.STRING, description: 'Išlaidų ID' },
      amount: { type: Type.NUMBER, description: 'Nauja suma' },
      title: { type: Type.STRING, description: 'Naujas pavadinimas' },
      date: { type: Type.STRING, description: 'Nauja data (YYYY-MM-DD)' },
      category: {
        type: Type.STRING,
        enum: ['kuras', 'priemonės', 'reklama', 'kita'],
        description: 'Nauja kategorija',
      },
      notes: { type: Type.STRING, description: 'Naujos pastabos' },
    },
    required: ['expenseId'],
  },
};

export const deleteExpenseTool: FunctionDeclaration = {
  name: 'delete_expense',
  parameters: {
    type: Type.OBJECT,
    description: 'Ištrinti išlaidas.',
    properties: {
      expenseId: { type: Type.STRING, description: 'Išlaidų ID' },
    },
    required: ['expenseId'],
  },
};

export const addMemoryTool: FunctionDeclaration = {
  name: 'add_memory',
  parameters: {
    type: Type.OBJECT,
    description: 'Išsaugoti svarbią informaciją asistento atminčiai (ilgalaikė atmintis).',
    properties: {
      content: { type: Type.STRING, description: 'Informacija, kurią reikia įsiminti' },
      category: {
        type: Type.STRING,
        enum: ['klientas', 'verslas', 'procesas', 'kita'],
        description: 'Kategorija',
      },
      importance: { type: Type.NUMBER, description: 'Svarba (1-5)' },
    },
    required: ['content', 'category'],
  },
};

export const updateMemoryTool: FunctionDeclaration = {
  name: 'update_memory',
  parameters: {
    type: Type.OBJECT,
    description: 'Atnaujinti esamą atmintį.',
    properties: {
      memoryId: { type: Type.STRING, description: 'Atminties ID' },
      content: { type: Type.STRING, description: 'Naujas turinys' },
      category: {
        type: Type.STRING,
        enum: ['klientas', 'verslas', 'procesas', 'kita'],
        description: 'Nauja kategorija',
      },
      importance: { type: Type.NUMBER, description: 'Nauja svarba (1-5)' },
    },
    required: ['memoryId'],
  },
};

export const deleteMemoryTool: FunctionDeclaration = {
  name: 'delete_memory',
  parameters: {
    type: Type.OBJECT,
    description: 'Ištrinti atmintį.',
    properties: {
      memoryId: { type: Type.STRING, description: 'Atminties ID' },
    },
    required: ['memoryId'],
  },
};

export const getNeglectedClientsTool: FunctionDeclaration = {
  name: 'get_neglected_clients',
  parameters: {
    type: Type.OBJECT,
    description:
      'Randa klientų, kurie nebuvo aptarnauti per nurodytą dienų skaičių. Naudinga norint priminti apie paslaugas.',
    properties: {
      days: { type: Type.NUMBER, description: 'Dienų skaičius (numatyta: 90 dienų)' },
    },
  },
};

export const getLowInventoryTool: FunctionDeclaration = {
  name: 'get_low_inventory',
  parameters: {
    type: Type.OBJECT,
    description:
      'Randa inventoriaus prekes, kurių kiekis yra žemiau minimalaus ribos. Naudinga planuojant pirkimus.',
    properties: {},
  },
};

export const getUnpaidOrdersTool: FunctionDeclaration = {
  name: 'get_unpaid_orders',
  parameters: {
    type: Type.OBJECT,
    description:
      'Randa užsakymus, kurie yra atlikti bet dar nėra apmokėti. Padeda sekti mokėjimus.',
    properties: {},
  },
};

export const getBusinessSummaryTool: FunctionDeclaration = {
  name: 'get_business_summary',
  parameters: {
    type: Type.OBJECT,
    description:
      'Pateikia verslo suvestinę už nurodytą laikotarpį: pajamas, išlaidas, pelną, užsakymų skaičių.',
    properties: {
      period: {
        type: Type.STRING,
        enum: ['week', 'month', 'year'],
        description: 'Laikotarpis: week (savaitė), month (mėnuo), year (metai)',
      },
    },
  },
};

export const getTopClientsTool: FunctionDeclaration = {
  name: 'get_top_clients',
  parameters: {
    type: Type.OBJECT,
    description:
      'Pateikia pelningiausius ar dažniausiai užsakančius klientus. Padeda nustatyti svarbiausius klientus.',
    properties: {
      limit: { type: Type.NUMBER, description: 'Kiek klientų rodyti (numatyta: 5)' },
      by: {
        type: Type.STRING,
        enum: ['orders', 'revenue'],
        description: 'Rikiuoti pagal: orders (užsakymų skaičius) arba revenue (pajamas)',
      },
    },
  },
};

export const getRevenueTrendsTool: FunctionDeclaration = {
  name: 'get_revenue_trends',
  parameters: {
    type: Type.OBJECT,
    description:
      'Pateikia pajamų tendencijas per nurodytą mėnesių skaičių. Naudinga planuojant biudžetą.',
    properties: {
      months: { type: Type.NUMBER, description: 'Mėnesių skaičius (numatyta: 6)' },
    },
  },
};

export const createRecurringOrderTool: FunctionDeclaration = {
  name: 'create_recurring_order',
  parameters: {
    type: Type.OBJECT,
    description: 'Sukuria kartotinį užsakymą, kuris bus kartojamas kas nurodytą mėnesių skaičių.',
    properties: {
      clientName: { type: Type.STRING, description: 'Kliento vardas' },
      address: { type: Type.STRING, description: 'Valymo adresas' },
      date: { type: Type.STRING, description: 'Pradžios data (YYYY-MM-DD)' },
      time: { type: Type.STRING, description: 'Laikas (HH:MM)' },
      windowCount: { type: Type.NUMBER, description: 'Langų kiekis' },
      floor: { type: Type.NUMBER, description: 'Aukštas' },
      intervalMonths: {
        type: Type.NUMBER,
        description: 'Kartojimo intervalas mėnesiais (pvz. 1 = kas mėnesį)',
      },
      additionalServices: {
        type: Type.OBJECT,
        description: 'Papildomos paslaugos',
        properties: {
          balkonai: { type: Type.BOOLEAN },
          vitrinos: { type: Type.BOOLEAN },
          terasa: { type: Type.BOOLEAN },
          kiti: { type: Type.BOOLEAN },
        },
      },
    },
    required: ['clientName', 'address', 'date', 'time', 'windowCount', 'floor', 'intervalMonths'],
  },
};

export const generateReminderMessageTool: FunctionDeclaration = {
  name: 'generate_reminder_message',
  parameters: {
    type: Type.OBJECT,
    description: 'Sugalvoja priminimo žinutę klientui pagal užsakymą, naudojant SMS šabloną.',
    properties: {
      orderId: { type: Type.STRING, description: 'Užsakymo ID' },
    },
    required: ['orderId'],
  },
};

export const batchUpdateOrderStatusTool: FunctionDeclaration = {
  name: 'batch_update_order_status',
  parameters: {
    type: Type.OBJECT,
    description:
      'Masinis užsakymų būsenos pakeitimas. Naudinga kai reikia vienu metu atnaujinti daug užsakymų.',
    properties: {
      orderIds: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: 'Užsakymų ID sąrašas',
      },
      status: {
        type: Type.STRING,
        enum: ['suplanuota', 'vykdoma', 'atlikta'],
        description: 'Nauja būsena',
      },
    },
    required: ['orderIds', 'status'],
  },
};

export const ALL_TOOLS: FunctionDeclaration[] = [
  addClientTool,
  addOrderTool,
  addExpenseTool,
  updateOrderTool,
  deleteOrderTool,
  updateClientTool,
  deleteClientTool,
  updateExpenseTool,
  deleteExpenseTool,
  addMemoryTool,
  updateMemoryTool,
  deleteMemoryTool,
  geocodeAddressTool,
  // Proactive alerts
  getNeglectedClientsTool,
  getLowInventoryTool,
  getUnpaidOrdersTool,
  // Business analytics
  getBusinessSummaryTool,
  getTopClientsTool,
  getRevenueTrendsTool,
  // Workflow automation
  createRecurringOrderTool,
  generateReminderMessageTool,
  batchUpdateOrderStatusTool,
];
