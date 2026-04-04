/**
 * Modular System Prompt System
 *
 * Dynamically assembles AI prompts from modular components
 * to reduce token usage, improve focus, and enable context-aware responses.
 */

import { ExtendedIntention, ClassificationResult } from './hybridClassifier';
import { PrioritizedMemory } from './memoryPriority';

// ============================================================
// TYPES & INTERFACES
// ============================================================

interface PromptModule {
  id: string;
  name: string;
  type: 'identity' | 'behavior' | 'tools' | 'context' | 'examples' | 'rules';
  content: string;
  tokens: number; // Estimated token count
  priority: number; // For dynamic assembly (1-10)
  conditions: PromptCondition[];
}

interface PromptCondition {
  field: 'intention' | 'hasTools' | 'hasMemories' | 'timeOfDay' | 'clientType';
  operator: 'equals' | 'includes' | 'exists' | 'gt' | 'lt';
  value: any;
}

interface PromptAssemblyConfig {
  maxTokens: number;
  includeExamples: boolean;
  includeDebugInfo: boolean;
  contextWindow: number;
  lastMessages: string[];
}

interface AssemblyResult {
  modules: PromptModule[];
  totalTokens: number;
  warnings: string[];
}

// ============================================================
// IDENTITY MODULES (Core identity, always included)
// ============================================================

const IDENTITY_MODULES: PromptModule[] = [
  {
    id: 'core_identity',
    name: 'Pagrindinė tapatybė',
    type: 'identity',
    content: `Esi "Švarus Darbas" (svarusdarbas.lt) - specializuotas AI asistentas langų valymo įmonei Klaipėdoje.

Pagrindinis tikslas: padėti vadovui valdyti verslą efektyviai, teikiant aiškias ataskaitas, priminimus ir rekomendacijas.

Specializacija: langų valymas, pastatų priežiūra, klientų valdymas, užsakymų planavimas.`,
    tokens: 65,
    priority: 10,
    conditions: [],
  },
  {
    id: 'personality',
    name: 'Asmenybė',
    type: 'identity',
    content: `Asmenybė:
- Profesionalus, bet draugiškas
- Proaktyvus - siūlyk sprendimus, nelauk kol paklaus
- Tikslus - naudoj konkrečius skaičius ir faktus
- Efektyvus - atsakyk glaustai, bet informatyviai
- Lietuviškai - visada atsakyk lietuvių kalba`,
    tokens: 45,
    priority: 9,
    conditions: [],
  },
  {
    id: 'business_context',
    name: 'Verslo kontekstas',
    type: 'identity',
    content: `Verslo kontekstas:
- Įmonė: Švarus Darbas (Klaipėda)
- Veikla: langų valymas, pastatų priežiūra
- Regionas: Klaipėda ir aplinkiniai rajonai
- Klientai: butai, namai, ofisai, vitrinos
- Sezoniškumas: vasarą daugiau lauko darbų, žiemą - vidaus`,
    tokens: 55,
    priority: 8,
    conditions: [],
  },
];

// ============================================================
// BEHAVIOR MODULES (Dynamic based on context)
// ============================================================

const BEHAVIOR_MODULES: PromptModule[] = [
  {
    id: 'proactive_behavior',
    name: 'Proaktyvus elgesys',
    type: 'behavior',
    content: `Proaktyvus elgesys:
- Jei matai neaplankytų klientų >60 dienų - pasiūlyk priminti
- Jei yra neapmokėtų užsakymų >30 dienų - perspėk
- Siūlyk sezoninius pasiūlymus pagal metų laiką
- Primink apie atsargų trūkumą jei žinoma
- Rekomenduok efektyvesnius darbo procesus`,
    tokens: 50,
    priority: 9,
    conditions: [{ field: 'hasTools', operator: 'equals', value: true }],
  },
  {
    id: 'data_analysis_behavior',
    name: 'Duomenų analizės elgesys',
    type: 'behavior',
    content: `Duomenų analizės elgesys:
- Pateik ataskaitas su aiškiais skaičiais
- Naudoj lentelės formatą dideliems sąrašams
- Palygink duomenis su ankstesniais laikotarpiais
- Išskirk svarbiausius rodiklius
- Pateik vizualią santrauką prieš detales`,
    tokens: 45,
    priority: 8,
    conditions: [
      {
        field: 'intention',
        operator: 'includes',
        value: ['business_summary', 'revenue_analysis', 'expense_analysis'],
      },
    ],
  },
  {
    id: 'client_communication',
    name: 'Klientų komunikacijos elgesys',
    type: 'behavior',
    content: `Klientų komunikacijos elgesys:
- Naudok mandagų, bet ne pernelyg formali toną
- Primink svarbias detales (data, laikas, kaina)
- Siūlyk papildomas paslaugas pagal kontekstą
- Išsaugok klientų pageidavimus atmintyje
- Rekomenduok geriausią laiką pagal užimtumą`,
    tokens: 40,
    priority: 7,
    conditions: [
      {
        field: 'intention',
        operator: 'includes',
        value: ['send_reminder', 'client_followup', 'generate_sms'],
      },
    ],
  },
  {
    id: 'safety_behavior',
    name: 'Saugos elgesys',
    type: 'behavior',
    content: `Saugos elgesys:
- VISADA pabrėžk saugos taisykles dirbant aukštyje
- Primink apie tinkamą įrangą
- Įspėk apie pavojingas sąlygas (lietus, stiprus vėjas)
- Rekomenduok apmokymus naujiems darbuotojams
- Visada atsižvelk į darbo aplinką`,
    tokens: 45,
    priority: 10,
    conditions: [
      {
        field: 'intention',
        operator: 'includes',
        value: ['safety_protocols', 'cleaning_schedule'],
      },
    ],
  },
  {
    id: 'general_behavior',
    name: 'Bendras elgesys',
    type: 'behavior',
    content: `Bendras elgesys:
- Atsakyk glaustai, bet išsamiai
- Naudok emoji struktūrizuoti atsakymams
- Pateik konkrečius veiksmus, o ne bendrus patarimus
- Jei nežinai atsakymo, taip ir pasakyk
- Visada siūlyk kitą žingsnį po atsakymo`,
    tokens: 40,
    priority: 5,
    conditions: [],
  },
];

// ============================================================
// TOOLS MODULES (Dynamic based on available tools)
// ============================================================

const TOOLS_MODULES: PromptModule[] = [
  {
    id: 'client_tools',
    name: 'Klientų įrankiai',
    type: 'tools',
    content: `Klientų valdymo įrankiai:
- add_client: Pridėti naują klientą (name, phone, address, buildingType)
- update_client: Atnaujinti kliento duomenis
- delete_client: Ištrinti klientą
- get_client_history: Gauti kliento istoriją

Naudok šiuos įrankius tiksliai pagal aprašymą. Visada patvirtink prieš trinant.`,
    tokens: 60,
    priority: 8,
    conditions: [
      {
        field: 'intention',
        operator: 'includes',
        value: ['add_client', 'update_client', 'delete_client', 'client_history'],
      },
    ],
  },
  {
    id: 'order_tools',
    name: 'Užsakymų įrankiai',
    type: 'tools',
    content: `Užsakymų valdymo įrankiai:
- add_order: Sukurti užsakymą (clientName, address, date, time, windowCount, floor)
- update_order: Atnaujinti užsakymą (status, notes, totalPrice)
- delete_order: Ištrinti užsakymą
- get_unpaid_orders: Rasti neapmokėtus užsakymus
- create_recurring_order: Sukurti kartotinį užsakymą

Visada patikrink užsakymo prieš ištrinant arba atnaujinant.`,
    tokens: 70,
    priority: 8,
    conditions: [
      {
        field: 'intention',
        operator: 'includes',
        value: ['add_order', 'update_order', 'delete_order', 'unpaid_orders', 'recurring_orders'],
      },
    ],
  },
  {
    id: 'expense_tools',
    name: 'Išlaidų įrankiai',
    type: 'tools',
    content: `Išlaidų valdymo įrankiai:
- add_expense: Registruoti išlaidas (title, amount, date, category)
- update_expense: Atnaujinti išlaidas
- delete_expense: Ištrinti išlaidas
- get_expense_analysis: Gauti išlaidų analizę

Kategorijos: kuras, priemonės, reklama, mokesčiai, kita.`,
    tokens: 50,
    priority: 7,
    conditions: [
      {
        field: 'intention',
        operator: 'includes',
        value: ['add_expense', 'update_expense', 'delete_expense', 'expense_analysis'],
      },
    ],
  },
  {
    id: 'memory_tools',
    name: 'Atminties įrankiai',
    type: 'tools',
    content: `Atminties valdymo įrankiai:
- add_memory: Įsiminti svarbią informaciją (content, category, importance)
- update_memory: Atnaujinti prisiminimą
- delete_memory: Ištrinti prisiminimą

Kategorijos: klientas, verslas, procesas, kita.
Svarba: 1-5 (5 - labai svarbu).`,
    tokens: 45,
    priority: 7,
    conditions: [
      {
        field: 'intention',
        operator: 'includes',
        value: ['add_memory', 'update_memory', 'delete_memory'],
      },
    ],
  },
  {
    id: 'analytics_tools',
    name: 'Analitikos įrankiai',
    type: 'tools',
    content: `Analitikos įrankiai:
- get_business_summary: Verslo suvestinė (week/month/year)
- get_top_clients: Top klientai pagal pajamas/užsakymus
- get_revenue_trends: Pajamų tendencijos
- get_neglected_clients: Neaktyvūs klientai
- get_profit_margin: Pelno marža

Visada naudoj nurodytą laikotarpį ir formatuok atsakymą aiškiai.`,
    tokens: 55,
    priority: 8,
    conditions: [
      {
        field: 'intention',
        operator: 'includes',
        value: [
          'business_summary',
          'top_clients',
          'revenue_trends',
          'neglected_clients',
          'profit_margin',
        ],
      },
    ],
  },
  {
    id: 'communication_tools',
    name: 'Komunikacijos įrankiai',
    type: 'tools',
    content: `Komunikacijos įrankiai:
- generate_reminder_message: Sugeneruoti SMS priminimą
- generate_sms: Sugeneruoti SMS žinutę
- get_client_followup: Gauti klientų sekimo sąrašą

Žinutės turėtų būti mandagios, glaustos ir aiškios.`,
    tokens: 40,
    priority: 7,
    conditions: [
      {
        field: 'intention',
        operator: 'includes',
        value: ['send_reminder', 'generate_sms', 'client_followup'],
      },
    ],
  },
  {
    id: 'workflow_tools',
    name: 'Workflow įrankiai',
    type: 'tools',
    content: `Workflow automatizavimo įrankiai:
- batch_update_order_status: Masinis užsakymų statuso keitimas
- create_recurring_order: Sukurti kartotinį užsakymą

Šie įrankiai skirti efektyvumui didinti. Visada patvirtink prieš masinius pakeitimus.`,
    tokens: 35,
    priority: 6,
    conditions: [
      { field: 'intention', operator: 'includes', value: ['batch_operations', 'recurring_orders'] },
    ],
  },
];

// ============================================================
// EXAMPLES MODULES (Few-shot learning)
// ============================================================

const EXAMPLES_MODULES: PromptModule[] = [
  {
    id: 'business_examples',
    name: 'Verslo pavyzdžiai',
    type: 'examples',
    content: `Verslo ataskaitų pavyzdžiai:

Vartotojas: "Koks mūsų pelnas šį mėnesį?"
Atsakymas: "📊 Šio mėnesio pelnas: 2,450€ (pajamos: 8,500€, išlaidos: 6,050€). Tai 15% daugiau nei praėjusį mėnesį."

Vartotojas: "Kurie klientai daugiausiai uždirba?"
Atsakymas: "🏆 Top 3 klientai pagal pajamas:
1. UAB 'Baltija' - 1,200€
2. Jonas Petraitis - 850€
3. UAB 'Marių bangos' - 720€"`,
    tokens: 85,
    priority: 6,
    conditions: [
      { field: 'intention', operator: 'includes', value: ['business_summary', 'top_clients'] },
    ],
  },
  {
    id: 'reminder_examples',
    name: 'Priminimų pavyzdžiai',
    type: 'examples',
    content: `Priminimų pavyzdžiai:

Vartotojas: "Sugeneruok priminimą Jonui"
Atsakymas: "📱 SMS Jonui Petraičiui:
Sveiki, Jonai! Primename apie langų valymą 2024-03-28 10:00. Kaina: 45€. Iki pasimatymo!"

Vartotojas: "Kas turėtų gauti priminimus?"
Atsakymas: "🔔 Šie klientai turėtų gauti priminimus:
- Ona Kazlauskienė (30 dienų be užsakymo)
- UAB 'Lietus' (45 dienų, reguliarus klientas)"`,
    tokens: 90,
    priority: 6,
    conditions: [
      { field: 'intention', operator: 'includes', value: ['send_reminder', 'generate_sms'] },
    ],
  },
];

// ============================================================
// RULES MODULES (Safety and compliance)
// ============================================================

const RULES_MODULES: PromptModule[] = [
  {
    id: 'safety_rules',
    name: 'Saugos taisyklės',
    type: 'rules',
    content: `SAUGOS TAISYKLĖS (PRIVALOMOS):
1. VISADA primink apie saugos dirbant aukštyje
2. Niekada nesiūlyk dirbti blogomis oro sąlygomis
3. Rekomenduok tinkamą įrangą (kėdės, diržai, šalmai)
4. Primink apie draudimą ir atsakomybę
5. Jei kyla abejonių dėl saugos, visada rekomenduok konsultaciją su specialistu

Saugumas yra svarbiau už efektyvumą!`,
    tokens: 65,
    priority: 10,
    conditions: [
      {
        field: 'intention',
        operator: 'includes',
        value: ['safety_protocols', 'cleaning_schedule', 'ai_suggest'],
      },
    ],
  },
  {
    id: 'data_privacy',
    name: 'Duomenų privatumas',
    type: 'rules',
    content: `DUOMENŲ PRIVATUMO TAISYKLĖS:
1. Niekada nesidalink klientų asmeniniais duomenimis be sutikimo
2. Slapukų numerius, adresus ir kitą jautrią informaciją saugok atsakingai
3. Neįrašyk slaptažodžių, PIN kodus ar kitus autentifikavimo duomenis
4. Jei reikia dalintis duomenimis, visada gauk sutikimą
5. Ištrink jautrius duomenis prašant klientui`,
    tokens: 55,
    priority: 9,
    conditions: [],
  },
  {
    id: 'ai_limitations',
    name: 'AI apribojimai',
    type: 'rules',
    content: `AI APRIBOJIMAI:
1. Nežinau realaus laiko orų ar eismo situacijos
2. Negaliu tiesiogiai susisiekti su klientais (be įrankių)
3. Negaliu atlikti mokėjimų ar sutarčių
4. Galiu klysti - visada patikrink svarbius sprendimus
5. Rekomendacijos yra pagrįstos turimais duomenimis, ne absoliučios`,
    tokens: 45,
    priority: 5,
    conditions: [],
  },
  {
    id: 'response_format',
    name: 'Atsakymo formatas',
    type: 'rules',
    content: `ATSAKYMO FORMATAS:
- Trumpas įvadas (1-2 sakiniai)
- Pagrindinė informacija (su emoji struktūra)
- Aiškūs skaičiai ir datos
- Pasiūlytas kitas žingsnis
- Klausimas vartotojui (jei reikia)

Naudok Markdown formatavimą: **svarbu**, *pabrėžimui*, \`kodui\`.`,
    tokens: 40,
    priority: 6,
    conditions: [],
  },
];

// ============================================================
// PROMPT ASSEMBLY ENGINE
// ============================================================

export class ModularPromptAssembler {
  private config: PromptAssemblyConfig;

  constructor(config: Partial<PromptAssemblyConfig> = {}) {
    this.config = {
      maxTokens: config.maxTokens || 2000,
      includeExamples: config.includeExamples ?? true,
      includeDebugInfo: config.includeDebugInfo ?? false,
      contextWindow: config.contextWindow || 5,
      lastMessages: config.lastMessages || [],
      ...config,
    };
  }

  /**
   * Assemble prompt modules based on current context
   */
  assemble(
    classification: ClassificationResult,
    memories: PrioritizedMemory[],
    availableTools: string[],
    businessContext?: {
      clientCount?: number;
      orderCount?: number;
      revenue?: number;
    }
  ): AssemblyResult {
    const selectedModules: PromptModule[] = [];
    const warnings: string[] = [];
    let totalTokens = 0;

    // 1. Always include core identity modules
    IDENTITY_MODULES.forEach((module) => {
      if (this.checkConditions(module.conditions, classification, memories, businessContext)) {
        selectedModules.push(module);
        totalTokens += module.tokens;
      }
    });

    // 2. Add behavior modules based on intention
    BEHAVIOR_MODULES.forEach((module) => {
      if (this.checkConditions(module.conditions, classification, memories, businessContext)) {
        if (totalTokens + module.tokens <= this.config.maxTokens) {
          selectedModules.push(module);
          totalTokens += module.tokens;
        } else {
          warnings.push(`Skipped behavior module: ${module.name} (token limit)`);
        }
      }
    });

    // 3. Add relevant tools modules
    TOOLS_MODULES.forEach((module) => {
      if (this.checkConditions(module.conditions, classification, memories, businessContext)) {
        if (totalTokens + module.tokens <= this.config.maxTokens) {
          selectedModules.push(module);
          totalTokens += module.tokens;
        } else {
          warnings.push(`Skipped tools module: ${module.name} (token limit)`);
        }
      }
    });

    // 4. Add examples if enabled and space permits
    if (this.config.includeExamples && totalTokens + 100 < this.config.maxTokens) {
      EXAMPLES_MODULES.forEach((module) => {
        if (this.checkConditions(module.conditions, classification, memories, businessContext)) {
          if (totalTokens + module.tokens <= this.config.maxTokens * 0.7) {
            // Examples take max 70%
            selectedModules.push(module);
            totalTokens += module.tokens;
          }
        }
      });
    }

    // 5. Always include critical rules
    RULES_MODULES.forEach((module) => {
      if (module.priority >= 9) {
        // High priority rules always included
        if (totalTokens + module.tokens <= this.config.maxTokens) {
          selectedModules.push(module);
          totalTokens += module.tokens;
        } else {
          warnings.push(`CRITICAL: Skipped high-priority rule: ${module.name}`);
        }
      }
    });

    // 6. Add remaining rules if space permits
    if (totalTokens + 50 < this.config.maxTokens) {
      RULES_MODULES.forEach((module) => {
        if (
          module.priority < 9 &&
          this.checkConditions(module.conditions, classification, memories, businessContext)
        ) {
          if (totalTokens + module.tokens <= this.config.maxTokens * 0.8) {
            selectedModules.push(module);
            totalTokens += module.tokens;
          }
        }
      });
    }

    // Sort by priority
    selectedModules.sort((a, b) => b.priority - a.priority);

    return {
      modules: selectedModules,
      totalTokens,
      warnings,
    };
  }

  /**
   * Check if module conditions are met
   */
  private checkConditions(
    conditions: PromptCondition[],
    classification: ClassificationResult,
    memories: PrioritizedMemory[],
    businessContext?: { clientCount?: number; orderCount?: number; revenue?: number }
  ): boolean {
    if (conditions.length === 0) return true;

    return conditions.every((condition) => {
      switch (condition.field) {
        case 'intention':
          if (condition.operator === 'equals') {
            return classification.intention === condition.value;
          } else if (condition.operator === 'includes') {
            return (condition.value as ExtendedIntention[]).includes(classification.intention);
          }
          break;

        case 'hasTools':
          return classification.shouldExecuteTool === condition.value;

        case 'hasMemories':
          return memories.length > 0 === condition.value;

        case 'timeOfDay': {
          const hour = new Date().getHours();
          if (condition.operator === 'gt') return hour > condition.value;
          if (condition.operator === 'lt') return hour < condition.value;
          break;
        }

        case 'clientType':
          // Could check businessContext for client type
          return true;
      }

      return true;
    });
  }

  /**
   * Convert modules to final system prompt string
   */
  formatAsSystemPrompt(assemblyResult: AssemblyResult): string {
    const sections: string[] = [];

    // Group by type
    const grouped = {
      identity: assemblyResult.modules.filter((m) => m.type === 'identity'),
      behavior: assemblyResult.modules.filter((m) => m.type === 'behavior'),
      tools: assemblyResult.modules.filter((m) => m.type === 'tools'),
      rules: assemblyResult.modules.filter((m) => m.type === 'rules'),
      examples: assemblyResult.modules.filter((m) => m.type === 'examples'),
    };

    // Build sections
    if (grouped.identity.length > 0) {
      sections.push('## TAPATYBĖ\n' + grouped.identity.map((m) => m.content).join('\n\n'));
    }

    if (grouped.behavior.length > 0) {
      sections.push('## ELGESYS\n' + grouped.behavior.map((m) => m.content).join('\n\n'));
    }

    if (grouped.tools.length > 0) {
      sections.push('## ĮRANKIAI\n' + grouped.tools.map((m) => m.content).join('\n\n'));
    }

    if (grouped.rules.length > 0) {
      sections.push('## TAISYKLĖS\n' + grouped.rules.map((m) => m.content).join('\n\n'));
    }

    if (grouped.examples.length > 0 && this.config.includeExamples) {
      sections.push('## PAVYZDŽIAI\n' + grouped.examples.map((m) => m.content).join('\n\n'));
    }

    // Add metadata if debug mode
    if (this.config.includeDebugInfo) {
      sections.push(
        `\n---\n📊 Prompt Info: ${assemblyResult.totalTokens} tokens | ${assemblyResult.modules.length} modules | Warnings: ${assemblyResult.warnings.length}`
      );
    }

    return sections.join('\n\n');
  }
}

// ============================================================
// DYNAMIC CONTEXT ENRICHMENT
// ============================================================

export function enrichWithContext(
  basePrompt: string,
  context: {
    currentDate: string;
    recentOrders?: number;
    pendingPayments?: number;
    memoryCount?: number;
  }
): string {
  let enriched = basePrompt;

  // Add current date context
  enriched += `\n\n📅 Šiandienos data: ${context.currentDate}`;

  // Add business context if available
  if (context.recentOrders !== undefined || context.pendingPayments !== undefined) {
    enriched += '\n📊 Verslo situacija:';
    if (context.recentOrders !== undefined) {
      enriched += `\n- Paskutiniai užsakymai: ${context.recentOrders}`;
    }
    if (context.pendingPayments !== undefined) {
      enriched += `\n- Laukiantys mokėjimai: ${context.pendingPayments}`;
    }
  }

  // Add memory context
  if (context.memoryCount !== undefined && context.memoryCount > 0) {
    enriched += `\n\n🧠 Turi prieigą prie ${context.memoryCount} prisiminimų. Naudok juos kontekstui.`;
  }

  return enriched;
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

export function getTokenEstimate(text: string): number {
  // Rough estimate: 1 token ≈ 4 characters for Lithuanian
  return Math.ceil(text.length / 4);
}

export function createPromptSummary(modules: PromptModule[]): string {
  const summary = modules.map((m) => `${m.type}: ${m.name} (${m.tokens}t)`).join(', ');
  return `Prompt modules: ${summary}`;
}

// Export default configuration
export const DEFAULT_PROMPT_CONFIG: PromptAssemblyConfig = {
  maxTokens: 2000,
  includeExamples: true,
  includeDebugInfo: false,
  contextWindow: 5,
  lastMessages: [],
};
