# AI Assistant Plan for "Švarus Darbas" CRM

## Current State Analysis

### Already Implemented (✅)

- **Basic CRUD Operations**: add_client, add_order, add_expense, update/delete variants
- **Memory System**: add_memory, update_memory, delete_memory
- **Voice Input**: Microphone for speech-to-text
- **Voice Output**: Text-to-speech for responses
- **Multi-Provider Support**: Google Gemini + OpenRouter (free models)
- **Function Calling**: AI can execute app functions

### Missing / To Improve (🔲)

1. **Proactive Alerts**: No automatic reminders
2. **Business Analytics**: No advanced reporting tools
3. **Workflow Automation**: Limited automation
4. **Context Awareness**: Doesn't know current UI state

---

## Implementation Plan

### Phase 1: Proactive Alerts (Priority: HIGH)

#### 1.1 Get Clients Needing Attention

```typescript
// Returns clients not visited in X days
get_neglected_clients(days: number = 90)
```

**Logic**: Query orders, find clients with lastCleaningDate > X days ago

#### 1.2 Low Inventory Alerts

```typescript
// Returns items below minimum threshold
get_low_inventory();
```

**Logic**: Filter inventory where quantity < minQuantity

#### 1.3 Overdue Payments Check

```typescript
// Returns orders awaiting payment
get_unpaid_orders();
```

**Logic**: Find orders marked as "atlikta" but not paid

---

### Phase 2: Business Analytics (Priority: HIGH)

#### 2.1 Business Summary

```typescript
get_business_summary(period: 'week' | 'month' | 'year')
```

**Returns**:

- Total revenue
- Total expenses
- Net profit
- Number of orders
- Number of new clients

#### 2.2 Top Clients Analysis

```typescript
get_top_clients(limit: number = 5, by: 'orders' | 'revenue')
```

**Returns**: Clients with most orders or highest revenue

#### 2.3 Revenue Trends

```typescript
get_revenue_trends(months: number = 6)
```

**Returns**: Monthly revenue data for charting

---

### Phase 3: Workflow Automation (Priority: MEDIUM)

#### 3.1 Create Recurring Order

```typescript
create_recurring_order(clientId, date, intervalMonths, services);
```

**Logic**: Creates order with isRecurring=true

#### 3.2 Generate Reminder Message

```typescript
generate_reminder_message(orderId);
```

**Logic**: Uses settings.smsTemplate to generate SMS text

#### 3.3 Batch Update Orders

```typescript
batch_update_order_status(orderIds[], newStatus)
```

**Logic**: Bulk status update

---

### Phase 4: Enhanced Context (Priority: MEDIUM)

#### 4.1 Pass Current App State to AI

```typescript
// In ChatAssistant component
const context = {
  currentView: activeTab,
  selectedOrder: currentOrder,
  recentActions: last5Actions,
  todaySchedule: todaysOrders,
};
```

**Purpose**: AI understands what user is doing

#### 4.2 Smart Suggestions

Based on context:

- If viewing Analytics → suggest "Rodyk pelningiausius klientus"
- If viewing Orders → suggest "Rodyk šiandienos darbus"
- After adding order → suggest "Pridėti dar vieną užsakymą"

---

## Technical Implementation

### File Changes Required

1. **`src/services/aiService.ts`**
   - Add new FunctionDeclarations
   - Implement handler functions

2. **`src/components/ChatAssistant.tsx`**
   - Pass context to AI
   - Add proactive suggestion UI

### Example: New Tool Definition

```typescript
const getNeglectedClientsTool: FunctionDeclaration = {
  name: 'get_neglected_clients',
  description: 'Randa klientų, kurie nebuvo aptarnauti per nurodytą dienų skaičių',
  parameters: {
    type: Type.OBJECT,
    properties: {
      days: {
        type: Type.NUMBER,
        description: 'Dienų skaičius (numatyta: 90)',
      },
    },
  },
};
```

---

## User Experience Improvements

### Proactive Suggestions UI

```
┌─────────────────────────────────────┐
│ 🔔 Priminimai                       │
│ ─────────────────────────────────── │
│ ⚠️ 5 klientai neaplankyti 3 mėn.   │
│ ⚠️ Mažas valiklių kiekis sandėlyje │
│ 📊 Šią savaitę: 12 užsakymų, €450  │
└─────────────────────────────────────┘
```

### Quick Action Buttons

```
[📊 Analitika] [📅 Šiandien] [👥 Naujas klientas]
```

---

## Priority Order

1. get_neglected_clients - Immediate value
2. get_low_inventory - Immediate value
3. get_business_summary - Most requested
4. get_top_clients - Business insight
5. create_recurring_order - Automation
6. Context awareness - UX improvement

---

## Estimated Effort

- Phase 1: 2-3 hours
- Phase 2: 3-4 hours
- Phase 3: 2-3 hours
- Phase 4: 1-2 hours

\*\*Total: ~8-12 hours development time
