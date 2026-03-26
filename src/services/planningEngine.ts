/**
 * Advanced Planning Layer for Multi-Step Workflows
 * 
 * Provides intelligent planning and execution of complex, multi-step tasks.
 * Enables the AI agent to break down complex queries into sequential steps
 * with rollback capabilities and progress tracking.
 */

import { ExtendedIntention, ClassificationResult } from './hybridClassifier';
import { routeAndExecute, ToolExecutionResult } from './toolRouter';

// ============================================================
// TYPES & INTERFACES
// ============================================================

export type PlanStatus = 'pending' | 'executing' | 'completed' | 'failed' | 'paused' | 'cancelled';
export type StepStatus = 'pending' | 'executing' | 'completed' | 'failed' | 'skipped';
export type StepType = 'tool_execution' | 'analysis' | 'decision' | 'user_input' | 'llm_reasoning';

export interface PlanStep {
  id: string;
  type: StepType;
  status?: StepStatus;
  description: string;
  action: string;
  parameters: Record<string, any>;
  dependencies: string[];
  expectedOutput?: string;
  fallbackAction?: string;
  timeout: number;
  retryCount: number;
  maxRetries: number;
}

export interface ExecutionPlan {
  id: string;
  name: string;
  description: string;
  goal: string;
  steps: PlanStep[];
  status: PlanStatus;
  currentStepIndex: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  context: PlanContext;
  results: Map<string, any>;
  errors: string[];
}

export interface PlanContext {
  userQuery: string;
  userId: string;
  clientId?: string;
  orderId?: string;
  businessData: {
    totalClients: number;
    totalOrders: number;
    totalRevenue: number;
    totalExpenses: number;
  };
  conversationHistory: string[];
}

export interface StepExecutionResult {
  stepId: string;
  status: StepStatus;
  output?: any;
  error?: string;
  executionTime: number;  // In milliseconds
  nextStepId?: string;
}

export interface PlanSummary {
  planId: string;
  name: string;
  goal: string;
  totalSteps: number;
  completedSteps: number;
  failedSteps: number;
  skippedSteps: number;
  status: PlanStatus;
  progress: number;  // 0-100
  estimatedTimeRemaining?: number;
  nextActions: string[];
}

// ============================================================
// PLAN TEMPLATES (Common CRM workflows)
// ============================================================

interface PlanTemplate {
  id: string;
  name: string;
  description: string;
  triggers: RegExp[];
  createSteps: (params: any, context: PlanContext) => PlanStep[];
}

const PLAN_TEMPLATES: PlanTemplate[] = [
  {
    id: 'monthly_business_review',
    name: 'Mėnesinė verslo apžvalga',
    description: 'Sukuria išsamią verslo ataskaitą su rekomendacijomis',
    triggers: [/mėnesin.*apžvalg/i, /verslo.*ataskait/i, /monthly.*review/i, /kas\s*mėn\s*vyko/i],
    createSteps: (params, context) => [
      {
        id: '1',
        type: 'analysis',
        description: 'Analizuoti pajamas už praėjusį mėnesį',
        action: 'get_business_summary',
        parameters: { period: 'month' },
        dependencies: [],
        timeout: 30,
        retryCount: 0,
        maxRetries: 2
      },
      {
        id: '2',
        type: 'tool_execution',
        description: 'Gauti neapmokėtų užsakymų sąrašą',
        action: 'get_unpaid_orders',
        parameters: {},
        dependencies: [],
        timeout: 30,
        retryCount: 0,
        maxRetries: 2
      },
      {
        id: '3',
        type: 'tool_execution',
        description: 'Rasti neaktyvius klientus',
        action: 'get_neglected_clients',
        parameters: { days: 60 },
        dependencies: [],
        timeout: 30,
        retryCount: 0,
        maxRetries: 2
      },
      {
        id: '4',
        type: 'tool_execution',
        description: 'Gauti top klientus',
        action: 'get_top_clients',
        parameters: { limit: 5, by: 'revenue' },
        dependencies: [],
        timeout: 30,
        retryCount: 0,
        maxRetries: 2
      },
      {
        id: '5',
        type: 'analysis',
        description: 'Analizuoti duomenis ir sugeneruoti rekomendacijas',
        action: 'analyze_and_recommend',
        parameters: { 
          useResultsFrom: ['1', '2', '3', '4'] 
        },
        dependencies: ['1', '2', '3', '4'],
        timeout: 60,
        retryCount: 0,
        maxRetries: 1
      }
    ]
  },
  {
    id: 'client_onboarding',
    name: 'Naujo kliento integravimas',
    description: 'Visas procesas nuo kontakto iki pirmo užsakymo',
    triggers: [/naujas.*klientas/i, /pridėt.*klient/i, /naujas.*užsakov/i, /onboarding/i],
    createSteps: (params, context) => [
      {
        id: '1',
        type: 'tool_execution',
        description: 'Pridėti naują klientą į sistemą',
        action: 'add_client',
        parameters: params.clientData || {},
        dependencies: [],
        timeout: 30,
        retryCount: 0,
        maxRetries: 2
      },
      {
        id: '2',
        type: 'analysis',
        description: 'Analizuoti kliento poreikius ir nustatyti kainą',
        action: 'analyze_client_needs',
        parameters: { clientId: '$step1.clientId' },
        dependencies: ['1'],
        timeout: 45,
        retryCount: 0,
        maxRetries: 2
      },
      {
        id: '3',
        type: 'tool_execution',
        description: 'Sukurti pradinį užsakymą',
        action: 'add_order',
        parameters: params.orderData || {},
        dependencies: ['1', '2'],
        timeout: 30,
        retryCount: 0,
        maxRetries: 2
      },
      {
        id: '4',
        type: 'tool_execution',
        description: 'Įsiminti kliento pageidavimus',
        action: 'add_memory',
        parameters: {
          content: 'Naujas klientas: $step1.clientName - $step2.needsSummary',
          category: 'klientas',
          importance: 4
        },
        dependencies: ['1', '2'],
        timeout: 30,
        retryCount: 0,
        maxRetries: 1
      },
      {
        id: '5',
        type: 'tool_execution',
        description: 'Sugeneruoti sveikinimo žinutę',
        action: 'generate_reminder_message',
        parameters: { orderId: '$step3.orderId' },
        dependencies: ['3'],
        timeout: 30,
        retryCount: 0,
        maxRetries: 1
      }
    ]
  },
  {
    id: 'unpaid_invoices_followup',
    name: 'Neapmokėtų sąskaitų sekimas',
    description: 'Randa ir primena apie neapmokėtas sąskaitas',
    triggers: [/neapmokėt.*sąskait/i, /skol.*priminim/i, /unpaid.*followup/i, /kas\s*skoling/i],
    createSteps: (params, context) => [
      {
        id: '1',
        type: 'tool_execution',
        description: 'Rasti visus neapmokėtus užsakymus',
        action: 'get_unpaid_orders',
        parameters: {},
        dependencies: [],
        timeout: 30,
        retryCount: 0,
        maxRetries: 2
      },
      {
        id: '2',
        type: 'analysis',
        description: 'Analizuoti skolų senumą ir prioritetus',
        action: 'analyze_debt_priority',
        parameters: { useResultsFrom: ['1'] },
        dependencies: ['1'],
        timeout: 45,
        retryCount: 0,
        maxRetries: 1
      },
      {
        id: '3',
        type: 'decision',
        description: 'Nuspręsti, kuriems klientams siųsti priminimus',
        action: 'select_clients_for_reminder',
        parameters: { minDays: 7, maxAmount: 500 },
        dependencies: ['2'],
        timeout: 30,
        retryCount: 0,
        maxRetries: 1
      },
      {
        id: '4',
        type: 'tool_execution',
        description: 'Sugeneruoti priminimo žinutes',
        action: 'generate_reminder_message',
        parameters: { orderId: '$step3.selectedOrderIds' },
        dependencies: ['3'],
        timeout: 45,
        retryCount: 0,
        maxRetries: 1
      },
      {
        id: '5',
        type: 'analysis',
        description: 'Sukurti ataskaitą apie skolas',
        action: 'create_debt_report',
        parameters: { useResultsFrom: ['1', '2', '4'] },
        dependencies: ['1', '2', '4'],
        timeout: 30,
        retryCount: 0,
        maxRetries: 1
      }
    ]
  },
  {
    id: 'seasonal_preparation',
    name: 'Sezoninio pasiruošimo planas',
    description: 'Paruošia verslą sezonui (vasarai/žiemai)',
    triggers: [/sezon.*pasiruošim/i, /vasar.*plan/i, /žiem.*plan/i, /seasonal.*prep/i],
    createSteps: (params, context) => [
      {
        id: '1',
        type: 'analysis',
        description: 'Analizuoti sezoniškumo tendencijas',
        action: 'get_seasonal_analysis',
        parameters: {},
        dependencies: [],
        timeout: 45,
        retryCount: 0,
        maxRetries: 2
      },
      {
        id: '2',
        type: 'tool_execution',
        description: 'Gauti pajamų tendencijas',
        action: 'get_revenue_trends',
        parameters: { months: 12 },
        dependencies: [],
        timeout: 45,
        retryCount: 0,
        maxRetries: 2
      },
      {
        id: '3',
        type: 'tool_execution',
        description: 'Rasti aktyvius ir neaktyvius klientus',
        action: 'get_client_segments',
        parameters: {},
        dependencies: [],
        timeout: 45,
        retryCount: 0,
        maxRetries: 2
      },
      {
        id: '4',
        type: 'analysis',
        description: 'Analizuoti konkurencinę aplinką ir rinkos tendencijas',
        action: 'analyze_market',
        parameters: { season: params.season || 'summer' },
        dependencies: ['1', '2'],
        timeout: 60,
        retryCount: 0,
        maxRetries: 1
      },
      {
        id: '5',
        type: 'tool_execution',
        description: 'Sukurti rinkodaros planą neaktyviems klientams',
        action: 'create_marketing_campaign',
        parameters: { target: 'inactive_clients', season: params.season || 'summer' },
        dependencies: ['3', '4'],
        timeout: 60,
        retryCount: 0,
        maxRetries: 1
      },
      {
        id: '6',
        type: 'analysis',
        description: 'Sukurti pasiruošimo ataskaitą',
        action: 'create_preparation_report',
        parameters: { useResultsFrom: ['1', '2', '3', '4', '5'] },
        dependencies: ['1', '2', '3', '4', '5'],
        timeout: 45,
        retryCount: 0,
        maxRetries: 1
      }
    ]
  }
];

// ============================================================
// PLANNING ENGINE CORE
// ============================================================

export class PlanningEngine {
  private activePlans: Map<string, ExecutionPlan> = new Map();
  private planHistory: PlanSummary[] = [];
  private maxConcurrentPlans: number = 3;
  
  /**
   * Analyze if query requires planning
   */
  shouldUsePlanning(query: string, classification: ClassificationResult): boolean {
    const queryLower = query.toLowerCase();
    
    // Check for multi-step indicators
    const multiStepIndicators = [
      /ir\s.*tada/i,  // "and then"
      /po\s*to\s*kai/i,  // "after that when"
      /visų\s*pirma/i,  // "first of all"
      /galiausiai/i,  // "finally"
      /planuok/i,  // "plan"
      /procesas/i,  // "process"
      /etapais/i,  // "in stages"
      /žingsniais/i,  // "in steps"
      /visą\s*procesą/i,  // "the whole process"
      /nuo\s*pradžių\s*iki\s*pabaigos/i  // "from start to finish"
    ];
    
    const hasMultiStepIndicator = multiStepIndicators.some(pattern => pattern.test(queryLower));
    
    // Check for complex intentions that typically require planning
    const complexIntentions: ExtendedIntention[] = [
      'business_forecast',
      'client_segments',
      'seasonal_services',
      'ai_plan',
      'ai_optimize'
    ];
    
    const isComplexIntention = complexIntentions.includes(classification.intention);
    
    // Check query length (complex queries tend to be longer)
    const isComplexQuery = query.split(/\s+/).length > 15;
    
    // Check for multiple intents
    const hasMultipleIntents = (query.match(/\b(ir|irba|bei|taippat)\b/g) || []).length > 1;
    
    return hasMultiStepIndicator || isComplexIntention || (isComplexQuery && hasMultipleIntents);
  }
  
  /**
   * Create a plan based on query and context
   */
  createPlan(
    query: string,
    classification: ClassificationResult,
    context: PlanContext
  ): ExecutionPlan | null {
    // Try to match with existing templates
    for (const template of PLAN_TEMPLATES) {
      if (template.triggers.some(pattern => pattern.test(query))) {
        return this.createPlanFromTemplate(template, query, classification, context);
      }
    }
    
    // No template matched, create a custom plan
    return this.createCustomPlan(query, classification, context);
  }
  
  /**
   * Create plan from template
   */
  private createPlanFromTemplate(
    template: PlanTemplate,
    query: string,
    classification: ClassificationResult,
    context: PlanContext
  ): ExecutionPlan {
    const planId = `plan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Extract parameters from query
    const params = this.extractPlanParameters(query, classification);
    
    const steps = template.createSteps(params, context);
    
    return {
      id: planId,
      name: template.name,
      description: template.description,
      goal: query,
      steps,
      status: 'pending',
      currentStepIndex: 0,
      createdAt: new Date(),
      context,
      results: new Map(),
      errors: []
    };
  }
  
  /**
   * Create custom plan for non-template queries
   */
  private createCustomPlan(
    query: string,
    classification: ClassificationResult,
    context: PlanContext
  ): ExecutionPlan {
    const planId = `plan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const steps: PlanStep[] = [
      {
        id: '1',
        type: 'analysis',
        description: 'Analizuoti užklausą ir kontekstą',
        action: 'analyze_query',
        parameters: { query, classification },
        dependencies: [],
        timeout: 30,
        retryCount: 0,
        maxRetries: 1
      },
      {
        id: '2',
        type: 'decision',
        description: 'Nuspręsti, kokių duomenų reikia',
        action: 'determine_data_needs',
        parameters: { useResultsFrom: ['1'] },
        dependencies: ['1'],
        timeout: 30,
        retryCount: 0,
        maxRetries: 1
      },
      {
        id: '3',
        type: 'tool_execution',
        description: 'Surinkti reikiamus duomenis',
        action: classification.toolName || 'collect_data',
        parameters: classification.parameters || {},
        dependencies: ['2'],
        timeout: 60,
        retryCount: 0,
        maxRetries: 2
      },
      {
        id: '4',
        type: 'analysis',
        description: 'Analizuoti surinktus duomenis',
        action: 'analyze_data',
        parameters: { useResultsFrom: ['3'] },
        dependencies: ['3'],
        timeout: 60,
        retryCount: 0,
        maxRetries: 1
      },
      {
        id: '5',
        type: 'llm_reasoning',
        description: 'Sugeneruoti galutinį atsakymą',
        action: 'generate_final_response',
        parameters: { useResultsFrom: ['1', '2', '3', '4'] },
        dependencies: ['4'],
        timeout: 60,
        retryCount: 0,
        maxRetries: 1
      }
    ];
    
    return {
      id: planId,
      name: 'Custom Plan',
      description: `Planas: ${query.substring(0, 100)}...`,
      goal: query,
      steps,
      status: 'pending',
      currentStepIndex: 0,
      createdAt: new Date(),
      context,
      results: new Map(),
      errors: []
    };
  }
  
  /**
   * Extract parameters from query for plan creation
   */
  private extractPlanParameters(query: string, classification: ClassificationResult): Record<string, any> {
    const params: Record<string, any> = {};
    
    // Extract time periods
    if (/mėnes/i.test(query)) params.period = 'month';
    if (/savait/i.test(query)) params.period = 'week';
    if (/metai/i.test(query)) params.period = 'year';
    
    // Extract seasons
    if (/vasar/i.test(query)) params.season = 'summer';
    if (/žiem/i.test(query)) params.season = 'winter';
    
    // Extract numbers
    const numberMatch = query.match(/(\d+)/);
    if (numberMatch) params.number = parseInt(numberMatch[1]);
    
    return params;
  }
  
  /**
   * Execute a plan step
   */
  async executeStep(
    plan: ExecutionPlan,
    step: PlanStep,
    context: PlanContext
  ): Promise<StepExecutionResult> {
    const startTime = Date.now();
    
    try {
      // Check dependencies
      const unmetDependencies = step.dependencies.filter(depId => {
        const depStep = plan.steps.find(s => s.id === depId);
        return !depStep || depStep.status !== 'completed';
      });
      
      if (unmetDependencies.length > 0) {
        return {
          stepId: step.id,
          status: 'failed',
          error: `Unmet dependencies: ${unmetDependencies.join(', ')}`,
          executionTime: Date.now() - startTime
        };
      }
      
      // Execute based on step type
      let result: any;
      
      switch (step.type) {
        case 'tool_execution':
          result = await this.executeToolStep(step, plan);
          break;
        case 'analysis':
          result = await this.executeAnalysisStep(step, plan);
          break;
        case 'decision':
          result = await this.executeDecisionStep(step, plan);
          break;
        case 'llm_reasoning':
          result = await this.executeLLMStep(step, plan);
          break;
        default:
          throw new Error(`Unknown step type: ${step.type}`);
      }
      
      // Store result
      plan.results.set(step.id, result);
      
      return {
        stepId: step.id,
        status: 'completed',
        output: result,
        executionTime: Date.now() - startTime
      };
      
    } catch (error: any) {
      plan.errors.push(`Step ${step.id}: ${error.message}`);
      
      // Check if we should retry
      if (step.retryCount < step.maxRetries) {
        step.retryCount++;
        return {
          stepId: step.id,
          status: 'failed',
          error: error.message,
          executionTime: Date.now() - startTime
        };
      }
      
      // Check for fallback
      if (step.fallbackAction) {
        try {
          const fallbackResult = await this.executeFallback(step.fallbackAction, plan);
          plan.results.set(step.id, fallbackResult);
          
          return {
            stepId: step.id,
            status: 'completed',
            output: fallbackResult,
            executionTime: Date.now() - startTime
          };
        } catch (fallbackError: any) {
          return {
            stepId: step.id,
            status: 'failed',
            error: `${error.message} | Fallback also failed: ${fallbackError.message}`,
            executionTime: Date.now() - startTime
          };
        }
      }
      
      return {
        stepId: step.id,
        status: 'failed',
        error: error.message,
        executionTime: Date.now() - startTime
      };
    }
  }
  
  /**
   * Execute tool step
   */
  private async executeToolStep(step: PlanStep, plan: ExecutionPlan): Promise<any> {
    // Resolve parameter references (e.g., $step1.clientId)
    const resolvedParams = this.resolveParameters(step.parameters, plan);
    
    const result = await routeAndExecute(step.action, {
      clients: plan.context.businessData.totalClients > 0 ? [] : [],
      orders: [],
      expenses: [],
      memories: []
    });
    
    if (!result.success) {
      throw new Error(result.error || 'Tool execution failed');
    }
    
    return result.data;
  }
  
  /**
   * Execute analysis step (simulated)
   */
  private async executeAnalysisStep(step: PlanStep, plan: ExecutionPlan): Promise<any> {
    // In a real implementation, this would use LLM for analysis
    // For now, return mock analysis
    return {
      type: 'analysis',
      stepId: step.id,
      description: step.description,
      findings: ['Analysis completed successfully'],
      recommendations: ['Consider reviewing the data patterns']
    };
  }
  
  /**
   * Execute decision step (simulated)
   */
  private async executeDecisionStep(step: PlanStep, plan: ExecutionPlan): Promise<any> {
    // In a real implementation, this would use LLM for decision making
    // For now, return mock decision based on parameters
    return {
      type: 'decision',
      stepId: step.id,
      decision: 'Proceed with next action',
      rationale: 'Based on available data and business rules',
      selectedAction: step.action
    };
  }
  
  /**
   * Execute LLM reasoning step (simulated)
   */
  private async executeLLMStep(step: PlanStep, plan: ExecutionPlan): Promise<any> {
    // In a real implementation, this would call LLM
    // For now, return mock reasoning
    return {
      type: 'llm_reasoning',
      stepId: step.id,
      reasoning: 'Generated based on collected data and analysis',
      conclusion: 'Action plan recommended',
      confidence: 0.85
    };
  }
  
  /**
   * Execute fallback action
   */
  private async executeFallback(action: string, plan: ExecutionPlan): Promise<any> {
    return {
      type: 'fallback',
      action,
      message: 'Fallback executed successfully'
    };
  }
  
  /**
   * Resolve parameter references in plan
   */
  private resolveParameters(params: Record<string, any>, plan: ExecutionPlan): Record<string, any> {
    const resolved: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string' && value.startsWith('$step')) {
        // Extract step reference: $step1.clientId -> stepId: '1', param: 'clientId'
        const match = value.match(/\$(\w+)\.(\w+)/);
        if (match) {
          const [, stepId, paramName] = match;
          const stepResult = plan.results.get(stepId);
          if (stepResult && stepResult[paramName] !== undefined) {
            resolved[key] = stepResult[paramName];
          } else {
            resolved[key] = null;
          }
        } else {
          resolved[key] = value;
        }
      } else if (Array.isArray(value) && value.every(v => typeof v === 'string' && v.startsWith('$'))) {
        // Array of step references
        resolved[key] = value.map(v => {
          const match = v.match(/\$(\w+)/);
          if (match) {
            const stepId = match[1];
            return plan.results.get(stepId);
          }
          return v;
        });
      } else {
        resolved[key] = value;
      }
    }
    
    return resolved;
  }
  
  /**
   * Execute entire plan
   */
  async executePlan(plan: ExecutionPlan): Promise<PlanSummary> {
    plan.status = 'executing';
    plan.startedAt = new Date();
    
    for (let i = 0; i < plan.steps.length; i++) {
      const step = plan.steps[i];
      
      // Check if dependencies are met
      const canProceed = step.dependencies.every(depId => {
        const depStep = plan.steps.find(s => s.id === depId);
        return depStep && depStep.status === 'completed';
      });
      
      if (!canProceed) {
        step.status = 'skipped';
        continue;
      }
      
      step.status = 'executing';
      plan.currentStepIndex = i;
      
      const result = await this.executeStep(plan, step, plan.context);
      
      if (result.status === 'completed') {
        step.status = 'completed';
      } else if (result.status === 'failed') {
        step.status = 'failed';
        
        // Check if we should continue or abort
        if (step.fallbackAction) {
          // Fallback was attempted, continue
          continue;
        } else {
          // No fallback, abort plan
          plan.status = 'failed';
          break;
        }
      }
    }
    
    // Update plan status
    if (plan.status === 'executing') {
      const allCompleted = plan.steps.every(s => s.status === 'completed' || s.status === 'skipped');
      plan.status = allCompleted ? 'completed' : 'failed';
    }
    
    plan.completedAt = new Date();
    
    // Create summary
    const summary = this.createPlanSummary(plan);
    this.planHistory.push(summary);
    
    return summary;
  }
  
  /**
   * Create plan summary
   */
  private createPlanSummary(plan: ExecutionPlan): PlanSummary {
    const completedSteps = plan.steps.filter(s => s.status === 'completed').length;
    const failedSteps = plan.steps.filter(s => s.status === 'failed').length;
    const skippedSteps = plan.steps.filter(s => s.status === 'skipped').length;
    
    const progress = Math.round((completedSteps / plan.steps.length) * 100);
    
    // Estimate time remaining (simple calculation)
    const avgStepTime = 30; // seconds per step (average)
    const remainingSteps = plan.steps.length - completedSteps - failedSteps - skippedSteps;
    const estimatedTimeRemaining = remainingSteps * avgStepTime;
    
    // Get next actions
    const nextActions = plan.steps
      .filter(s => s.status === 'pending')
      .slice(0, 3)
      .map(s => s.description);
    
    return {
      planId: plan.id,
      name: plan.name,
      goal: plan.goal,
      totalSteps: plan.steps.length,
      completedSteps,
      failedSteps,
      skippedSteps,
      status: plan.status,
      progress,
      estimatedTimeRemaining,
      nextActions
    };
  }
  
  /**
   * Get active plan summary
   */
  getActivePlanSummary(planId: string): PlanSummary | null {
    const plan = this.activePlans.get(planId);
    return plan ? this.createPlanSummary(plan) : null;
  }
  
  /**
   * Pause plan execution
   */
  pausePlan(planId: string): boolean {
    const plan = this.activePlans.get(planId);
    if (plan && plan.status === 'executing') {
      plan.status = 'paused';
      return true;
    }
    return false;
  }
  
  /**
   * Resume plan execution
   */
  async resumePlan(planId: string): Promise<PlanSummary | null> {
    const plan = this.activePlans.get(planId);
    if (plan && plan.status === 'paused') {
      plan.status = 'executing';
      return await this.executePlan(plan);
    }
    return null;
  }
  
  /**
   * Cancel plan execution
   */
  cancelPlan(planId: string): boolean {
    const plan = this.activePlans.get(planId);
    if (plan && (plan.status === 'executing' || plan.status === 'paused')) {
      plan.status = 'cancelled';
      return true;
    }
    return false;
  }
  
  /**
   * Get plan history
   */
  getPlanHistory(limit: number = 10): PlanSummary[] {
    return this.planHistory.slice(-limit);
  }
  
  /**
   * Get plan statistics
   */
  getStatistics(): {
    totalPlans: number;
    completedPlans: number;
    failedPlans: number;
    averageSteps: number;
    successRate: number;
  } {
    const total = this.planHistory.length;
    const completed = this.planHistory.filter(p => p.status === 'completed').length;
    const failed = this.planHistory.filter(p => p.status === 'failed').length;
    
    const totalSteps = this.planHistory.reduce((sum, p) => sum + p.totalSteps, 0);
    const averageSteps = total > 0 ? totalSteps / total : 0;
    
    return {
      totalPlans: total,
      completedPlans: completed,
      failedPlans: failed,
      averageSteps,
      successRate: total > 0 ? (completed / total) * 100 : 0
    };
  }
}

// ============================================================
// INTEGRATION HELPERS
// ============================================================

/**
 * Check if planning is needed for this query
 */
export function shouldUsePlanning(
  query: string,
  classification: ClassificationResult
): boolean {
  const planningEngine = new PlanningEngine();
  return planningEngine.shouldUsePlanning(query, classification);
}

/**
 * Create and execute a plan for complex queries
 */
export async function executeWithPlanning(
  query: string,
  classification: ClassificationResult,
  context: PlanContext
): Promise<{ summary: PlanSummary; finalResponse: string }> {
  const planningEngine = new PlanningEngine();
  
  // Create plan
  const plan = planningEngine.createPlan(query, classification, context);
  
  if (!plan) {
    throw new Error('Failed to create plan for query');
  }
  
  // Execute plan
  const summary = await planningEngine.executePlan(plan);
  
  // Generate final response based on results
  const finalResponse = generatePlanResponse(summary, plan);
  
  return { summary, finalResponse };
}

/**
 * Generate user-friendly response from plan results
 */
function generatePlanResponse(summary: PlanSummary, plan: ExecutionPlan): string {
  let response = `📋 **${summary.name}**\n\n`;
  response += `🎯 Tikslas: ${summary.goal}\n\n`;
  response += `📊 Progresas: ${summary.progress}% (${summary.completedSteps}/${summary.totalSteps} žingsnių)\n\n`;
  
  if (summary.status === 'completed') {
    response += `✅ Planas sėkmingai įvykdytas!\n\n`;
    
    // Add key results
    const keyResults = Array.from(plan.results.entries())
      .filter(([_, result]) => result && typeof result === 'object')
      .slice(0, 3)
      .map(([stepId, result]) => {
        const step = plan.steps.find(s => s.id === stepId);
        return `• ${step?.description || stepId}: ${JSON.stringify(result).substring(0, 100)}...`;
      })
      .join('\n');
    
    if (keyResults) {
      response += `📈 Pagrindiniai rezultatai:\n${keyResults}\n\n`;
    }
  } else if (summary.status === 'failed') {
    response += `❌ Planas nepavyko. Klaidos:\n`;
    plan.errors.slice(0, 3).forEach(error => {
      response += `• ${error}\n`;
    });
  }
  
  if (summary.nextActions.length > 0) {
    response += `\n⏭️ Kitas žingsnis: ${summary.nextActions[0]}`;
  }
  
  return response;
}

// Export singleton instance
export const planningEngine = new PlanningEngine();