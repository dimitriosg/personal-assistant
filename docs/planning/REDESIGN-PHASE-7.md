# Personal Assistant - Money Module v2
# REDESIGN-PHASE-7.md — AI Assistant

<!--
  COPILOT INSTRUCTIONS
  =====================
  This is a standalone spec for Phase 7 ONLY.
  Phases 1–6 must be complete before starting this.
  Do NOT modify any existing pages or components unless explicitly stated.

  Work through steps in exact order. Each step = one commit.

  How to focus Copilot:
    "Implement Phase 7 Step 1 — build /api/ai/chat endpoint for GPT-4o Mini"
    "Implement Phase 7 Step 7 — build the Single mode chat UI with streaming"
    "Implement Phase 7 Step 8 — build Compare mode side-by-side panels"
-->

---

## Goal

Replace the manual copy/paste workflow of the Prompt Generator with a
real AI chat interface that lives inside the app. The Prompt Generator
(`/prompt`) remains untouched as a fallback. Phase 7 adds a new
**AI Assistant** tab (`/assistant`) with two modes:

- **Single mode** — chat with one model (GPT-4o Mini or Claude Haiku)
- **Compare mode** — same question sent to both simultaneously,
  answers stream side by side

The AI always has full access to your live budget data. No copy/paste.
No context-switching. No leaving the app.

---

## Prerequisites

### Two API keys required

Create accounts and generate API keys from:

| Provider  | Key name             | Where to get it               |
|-----------|----------------------|-------------------------------|
| OpenAI    | `OPENAI_API_KEY`     | https://platform.openai.com   |
| Anthropic | `ANTHROPIC_API_KEY`  | https://console.anthropic.com |

Both are pay-as-you-go. No monthly commitment. A $5 credit on each
covers months of personal use.

### Add to `.env`

```env
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
AI_DEFAULT_MODEL=gpt4o_mini
AI_DEFAULT_MODE=single
```


### Install dependencies

```bash
npm install openai @anthropic-ai/sdk
```


---

## Models

| Model | Provider | Input (\$/1M) | Output (\$/1M) | Notes |
| :-- | :-- | :-- | :-- | :-- |
| GPT-4o Mini | OpenAI | \$0.15 | \$0.60 | Fast, cheap, great at structured data Q\&A |
| Claude Haiku 3.5 | Anthropic | \$1.00 | \$5.00 | More conversational tone, slightly slower |

Both models receive **identical system prompts** with identical live
budget context. Differences in their answers reflect model personality
only — not data differences.

**Cost per query (approx. 2,500 input + 400 output tokens):**


| Mode | GPT-4o Mini | Claude Haiku | Both (Compare) |
| :-- | :-- | :-- | :-- |
| Single | ~\$0.0006 | ~\$0.005 | n/a |
| Compare | n/a | n/a | ~\$0.006 |
| 100/mo | ~\$0.06 | ~\$0.50 | ~\$0.60 |
| 500/mo | ~\$0.30 | ~\$2.50 | ~\$3.00 |


---

## Data Model

### New table: `ai_conversations`

```sql
CREATE TABLE IF NOT EXISTS ai_conversations (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id TEXT    NOT NULL,
  role            TEXT    NOT NULL,
  -- role values: 'user' | 'gpt4o_mini' | 'haiku'
  content         TEXT    NOT NULL,
  model           TEXT    NOT NULL,
  -- model values: 'gpt-4o-mini' | 'claude-haiku-3-5' | 'compare'
  tokens_used     INTEGER DEFAULT 0,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_conv_id
  ON ai_conversations(conversation_id);
```

**Notes:**

- `conversation_id` is a UUID generated client-side when a new
conversation starts
- In Compare mode, both model answers are saved under the same
`conversation_id` with `role = 'gpt4o_mini'` and `role = 'haiku'`
- `tokens_used` is optional but useful for cost awareness

---

## Budget Context Builder

> File: `server/lib/budgetContext.ts` (new file)

This function is called before every AI request. It reads live data
from the DB and returns a formatted string injected into the system
prompt. Both models receive the exact same output from this function.

### What it collects

```ts
interface BudgetContext {
  currentMonth: string;          // "March 2026"
  readyToAssign: number;         // 165.50
  totalAssigned: number;         // 1496.12
  totalActivity: number;         // -1653.08
  expectedIncome: number;        // 1250.00
  costToBeMe: number;            // 1613.29
  groups: GroupContext[];
  overspentCategories: OverspentItem[];
  underfundedCategories: UnderfundedItem[];
  upcomingTargets: TargetItem[];
}

interface GroupContext {
  name: string;
  assigned: number;
  activity: number;
  available: number;
  categories: CategoryContext[];
}

interface CategoryContext {
  name: string;
  assigned: number;
  activity: number;
  available: number;
  target?: number;
}
```


### Formatted output (injected as system context)

```
BUDGET CONTEXT — March 2026
============================================================
Ready to Assign:    EUR 165.50
Total Assigned:     EUR 1,496.12
Total Spent:        EUR 1,653.08
Expected Income:    EUR 1,250.00
Cost to Be Me:      EUR 1,613.29

CATEGORY BREAKDOWN
------------------------------------------------------------
Group: Shared Expenses  | Assigned: 576 | Spent: 564 | Available: 12
  - Rent               | 300 | -300 |   0.00
  - Electricity        |  70 |  -41 |  29.00
  - Groceries          | 175 | -197 | -22.00  ← OVERSPENT

Group: Just for Fun     | Assigned: 239 | Spent: 254 | Available: -15
  - Coffee & Drink     |  76 |  -96 | -20.00  ← OVERSPENT
  - Food Delivery      |  95 | -111 | -16.00  ← OVERSPENT
  - Drink Out          |  21 |    0 |  21.00

[... all groups ...]

OVERSPENT CATEGORIES (4 total)
------------------------------------------------------------
  Coffee & Drink    -EUR 20.00
  Food Delivery     -EUR 16.00
  Groceries         -EUR 22.00
  Home & Office     -EUR 16.00

UNDERFUNDED CATEGORIES
------------------------------------------------------------
  YouTube           needs EUR 8.50 more
  Savings           needs EUR 100.00 more

UPCOMING TARGETS (next 30 days)
------------------------------------------------------------
  Car Insurance     due Apr 1  — needs EUR 54.00
============================================================
```


### System prompt wrapper

```ts
const SYSTEM_PROMPT = `
You are a personal finance assistant embedded in a budgeting app.
You have access to the user's live budget data below.

Rules:
- Answer ONLY based on the budget data provided. Do not invent numbers.
- Be concise and direct. No unnecessary preamble.
- When suggesting actions, be specific (category names, exact amounts).
- Use EUR currency. Format amounts as "EUR X.XX".
- If asked about something not in the budget data, say so clearly.
- Do not recommend external financial products or services.

${budgetContext}
`;
```


---

## API Endpoints

### `POST /api/ai/chat`

Single model chat. Streams the response.

**Request body:**

```json
{
  "message": "Can I afford dinner out tonight?",
  "model": "gpt4o_mini",
  "conversationId": "uuid-v4-string",
  "history": [
    {"role": "user", "content": "..."},
    {"role": "assistant", "content": "..."}
  ]
}
```

**`model` values:** `"gpt4o_mini"` | `"haiku"`

**Response:** Server-Sent Events (SSE) stream

```
data: {"delta": "Your Food"}
data: {"delta": " Delivery"}
data: {"delta": " category is -€16 overspent."}
data: {"done": true, "tokens_used": 387}
```

**Implementation:**

```ts
// server/routes/ai.ts

router.post('/chat', async (req, res) => {
  const { message, model, conversationId, history } = req.body;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const context = await buildBudgetContext();
  const systemPrompt = buildSystemPrompt(context);

  if (model === 'gpt4o_mini') {
    const stream = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      stream: true,
      messages: [
        { role: 'system', content: systemPrompt },
        ...history,
        { role: 'user', content: message }
      ]
    });

    let totalTokens = 0;
    for await (const chunk of stream) {
      const delta = chunk.choices?.delta?.content ?? '';
      if (delta) {
        res.write(`data: ${JSON.stringify({ delta })}\n\n`);
      }
      if (chunk.usage) totalTokens = chunk.usage.total_tokens;
    }
    res.write(`data: ${JSON.stringify({ done: true, tokens_used: totalTokens })}\n\n`);
    res.end();
  }

  if (model === 'haiku') {
    const stream = await anthropic.messages.stream({
      model: 'claude-haiku-3-5',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        ...history,
        { role: 'user', content: message }
      ]
    });

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta') {
        const delta = chunk.delta?.text ?? '';
        if (delta) res.write(`data: ${JSON.stringify({ delta })}\n\n`);
      }
    }
    const final = await stream.finalMessage();
    const tokens = final.usage.input_tokens + final.usage.output_tokens;
    res.write(`data: ${JSON.stringify({ done: true, tokens_used: tokens })}\n\n`);
    res.end();
  }
});
```


---

### `POST /api/ai/compare`

Calls both models in parallel. Streams both responses simultaneously
via two SSE channels identified by a `source` field.

**Request body:**

```json
{
  "message": "Can I afford a PS5 this month?",
  "conversationId": "uuid-v4-string"
}
```

**Response stream — both models interleaved:**

```
data: {"source": "gpt4o_mini", "delta": "Your PS5 goal"}
data: {"source": "haiku", "delta": "Looking at your"}
data: {"source": "gpt4o_mini", "delta": " has EUR 60 assigned"}
data: {"source": "haiku", "delta": " budget, the PS5 category"}
data: {"source": "gpt4o_mini", "done": true, "tokens_used": 312}
data: {"source": "haiku", "done": true, "tokens_used": 398}
```

**Implementation:**

```ts
router.post('/compare', async (req, res) => {
  const { message, conversationId } = req.body;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const context = await buildBudgetContext();
  const systemPrompt = buildSystemPrompt(context);

  const streamGPT = async () => {
    const stream = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      stream: true,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ]
    });
    for await (const chunk of stream) {
      const delta = chunk.choices?.delta?.content ?? '';
      if (delta) res.write(`data: ${JSON.stringify({ source: 'gpt4o_mini', delta })}\n\n`);
    }
    res.write(`data: ${JSON.stringify({ source: 'gpt4o_mini', done: true })}\n\n`);
  };

  const streamHaiku = async () => {
    const stream = await anthropic.messages.stream({
      model: 'claude-haiku-3-5',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: message }]
    });
    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta') {
        const delta = chunk.delta?.text ?? '';
        if (delta) res.write(`data: ${JSON.stringify({ source: 'haiku', delta })}\n\n`);
      }
    }
    res.write(`data: ${JSON.stringify({ source: 'haiku', done: true })}\n\n`);
  };

  await Promise.all([streamGPT(), streamHaiku()]);
  res.end();
});
```


---

### `GET /api/ai/conversations`

Returns list of past conversations (for history sidebar).

**Response:**

```json
[
  {
    "conversation_id": "uuid-1",
    "preview": "Can I afford dinner out tonight?",
    "model": "compare",
    "created_at": "2026-03-26T01:44:00Z",
    "message_count": 6
  }
]
```


---

### `GET /api/ai/conversations/:conversationId`

Returns all messages in a conversation.

**Response:**

```json
[
  {"role": "user", "content": "Can I afford a PS5?", "created_at": "..."},
  {"role": "gpt4o_mini", "content": "Your PS5 goal has...", "created_at": "..."},
  {"role": "haiku", "content": "Looking at your budget...", "created_at": "..."}
]
```


---

### `DELETE /api/ai/conversations/:conversationId`

Deletes a conversation and all its messages.

**Response:** `{ "deleted": true }`

---

## Page: AI Assistant (`/assistant`)

> File: `src/pages/Assistant.tsx` (new file)

### Navigation

Add to left sidebar between Prompt and Settings:

```
-  Prompt       (/prompt)     ← unchanged
-  AI Assistant (/assistant)  ← NEW
-  Settings     (/settings)
```


---

### Desktop Wireframe — Single Mode

```
+---------------------------------------------------------------+
|  AI ASSISTANT          [GPT-4o Mini ▼]    [⇄ Compare Mode]   |
+-----------------------------+---------------------------------+
|                             |                                 |
|  CONVERSATION HISTORY       |  CHAT AREA                      |
|  (200px, left panel)        |  (flexible, main area)          |
|                             |                                 |
|  + New Conversation         |  Quick actions:                 |
|  ─────────────────          |  [Where am I overspending?]     |
|  > Mar 26 — PS5 afford?     |  [Can I afford something?]      |
|    Mar 25 — Subscriptions   |  [What should I postpone?]      |
|    Mar 24 — Budget review   |  [Am I on track this month?]    |
|    Mar 20 — Food delivery   |  [Review my subscriptions]      |
|                             |                                 |
|                             |  ─────────────────────────────  |
|                             |                                 |
|                             |  > You                          |
|                             |  Can I afford a PS5 this month? |
|                             |                                 |
|                             |  ◆ GPT-4o Mini                  |
|                             |  Your PS5 goal category has     |
|                             |  EUR 60 assigned with EUR 0     |
|                             |  spent. The PS5 costs ~EUR 449. |
|                             |  You'd need EUR 389 more.       |
|                             |  Your Ready to Assign is        |
|                             |  EUR 165.50 — not enough.       |
|                             |  Consider postponing Food       |
|                             |  Delivery (EUR 95 target) for   |
|                             |  2 months to close the gap.     |
|                             |                                 |
|                             |  ─────────────────────────────  |
|                             |  [Type a question...]    [→]    |
+-----------------------------+---------------------------------+
```


---

### Desktop Wireframe — Compare Mode

```
+---------------------------------------------------------------+
|  AI ASSISTANT                              [← Single Mode]    |
+---------------------------------------------------------------+
|  Quick actions:                                               |
|  [Where am I overspending?] [Can I afford something?]         |
|  [What should I postpone?]  [Am I on track?]                  |
+--------------------------------+------------------------------+
|  GPT-4o Mini                   |  Claude Haiku                |
+--------------------------------+------------------------------+
|                                |                              |
|  Your Food Delivery category   |  Looking at your budget,     |
|  is EUR 16 overspent this      |  Food Delivery has gone      |
|  month. You also have Coffee   |  over budget by EUR 16.      |
|  & Drink at -EUR 20.           |  Coffee & Drink is also      |
|                                |  overspent by EUR 20.        |
|  Your Drink Out category has   |                              |
|  EUR 21 available — you could  |  I'd suggest moving the      |
|  move EUR 16 from there to     |  EUR 21 sitting in Drink     |
|  cover Food Delivery first.    |  Out to cover these gaps     |
|                                |  and stop the bleed.         |
|  ▌ (streaming)                 |                              |
+--------------------------------+------------------------------+
|  [👍 Use this answer]          |  [👍 Use this answer]        |
+--------------------------------+------------------------------+
|  [Type a question for both models...]               [→ Ask]   |
+---------------------------------------------------------------+
```


---

### Mobile Layout

**Single mode:**

```
+---------------------------+
| AI ASSISTANT  [Model ▼]   |
+---------------------------+
|  [Quick action chips →]   |
+---------------------------+
|                           |
|  CHAT AREA (full width)   |
|                           |
+---------------------------+
| [Type question...]  [→]   |
+---------------------------+
```

**Compare mode (mobile):** Stack models vertically — GPT-4o Mini answer
on top, Claude Haiku answer below. Both stream simultaneously.

---

## Component: `ChatMessage`

> File: `src/components/assistant/ChatMessage.tsx`

Renders a single message bubble. Handles streaming (partial content)
and completed states.

```tsx
interface ChatMessageProps {
  role: 'user' | 'gpt4o_mini' | 'haiku';
  content: string;
  isStreaming?: boolean;
}
```

**Visual spec:**


| Role | Alignment | Background | Label |
| :-- | :-- | :-- | :-- |
| user | right | `#2a2a4a` | "You" |
| gpt4o_mini | left | `#1e1e36` | "◆ GPT-4o Mini" with `text-blue-400` label |
| haiku | left | `#1e1e36` | "◆ Claude Haiku" with `text-purple-400` label |

- Streaming cursor: animated `▌` after last character while `isStreaming = true`
- Max width: 80% of chat area
- Text: 14px, `text-gray-100`
- Labels: 11px, semibold, colored per model

---

## Component: `QuickActions`

> File: `src/components/assistant/QuickActions.tsx`

```tsx
const QUICK_ACTIONS = [
  {
    label: "Where am I overspending?",
    message: "Looking at my current budget, which categories am I overspending in and by how much?"
  },
  {
    label: "Can I afford something?",
    message: null,    // triggers AmountPrompt modal before sending
    promptUser: true
  },
  {
    label: "What should I postpone?",
    message: "Based on my current budget, which categories or targets should I postpone this month to reduce financial stress?"
  },
  {
    label: "Am I on track?",
    message: "Give me a brief overall assessment of my budget this month. Am I on track, overspending, or doing well?"
  },
  {
    label: "Review my subscriptions",
    message: "List all my subscription categories, their assigned amounts, and flag any that I haven't actually spent money on this month."
  }
];
```

**"Can I afford something?" flow:**

1. User clicks the chip
2. Small inline form appears: `[Item name] [EUR amount] [Ask →]`
3. On submit, message becomes:
`"Can I afford [item] that costs EUR [amount] this month? Which category would it come from?"`

---

## Component: `ComparePanels`

> File: `src/components/assistant/ComparePanels.tsx`

Two side-by-side panels that consume the SSE stream from `/api/ai/compare`.

```tsx
interface ComparePanelsProps {
  question: string;
  conversationId: string;
  onSelectAnswer: (model: 'gpt4o_mini' | 'haiku', content: string) => void;
}
```

**State:**

```ts
const [gptContent, setGptContent] = useState('');
const [haikuContent, setHaikuContent] = useState('');
const [gptDone, setGptDone] = useState(false);
const [haikuDone, setHaikuDone] = useState(false);
```

**SSE consumer:**

```ts
const source = new EventSource('/api/ai/compare');
source.onmessage = (e) => {
  const data = JSON.parse(e.data);
  if (data.source === 'gpt4o_mini') {
    if (data.done) setGptDone(true);
    else setGptContent(prev => prev + data.delta);
  }
  if (data.source === 'haiku') {
    if (data.done) setHaikuDone(true);
    else setHaikuContent(prev => prev + data.delta);
  }
};
```

**"Use this answer" button behavior:**

- Saves the selected answer as the canonical assistant response
in the conversation history
- Switches the page back to Single mode with that model pre-selected
- User can continue chatting with the chosen model

---

## Component: `ConversationHistory`

> File: `src/components/assistant/ConversationHistory.tsx`

Left panel (desktop only — hidden on mobile, accessible via back button).

```tsx
interface ConversationHistoryProps {
  activeConversationId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}
```

**Visual:**

```
+ New Conversation
──────────────────────────────
● Mar 26  Compare  "Can I afford a PS5..."     [×]
  Mar 25  Haiku    "Review my subscriptions"   [×]
  Mar 24  GPT      "Budget check for March"    [×]
```

- Active conversation: highlighted row `bg-[#2a2a4a]`
- Model badge: small pill — `GPT` in blue, `Haiku` in purple, `Compare` in gradient
- Preview: first 40 chars of the first user message
- Delete: `×` button appears on hover, calls `DELETE /api/ai/conversations/:id`
- "New Conversation" generates a new UUID and clears the chat area

---

## Streaming Hook

> File: `src/hooks/useAIStream.ts`

Reusable hook that handles SSE consumption, state, and cleanup.

```ts
function useAIStream(endpoint: string) {
  const [content, setContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async (body: object) => {
    setContent('');
    setIsStreaming(true);
    setError(null);

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value);
        const lines = text.split('\n').filter(l => l.startsWith('data: '));
        for (const line of lines) {
          const data = JSON.parse(line.slice(6));
          if (data.done) { setIsStreaming(false); return; }
          if (data.delta) setContent(prev => prev + data.delta);
        }
      }
    } catch (e) {
      setError('Connection error. Please try again.');
      setIsStreaming(false);
    }
  };

  return { content, isStreaming, error, send };
}
```


---

## Error States

| Scenario | UI behavior |
| :-- | :-- |
| OpenAI API key missing | Show banner: "OpenAI API key not configured. Add OPENAI_API_KEY to .env" |
| Anthropic API key missing | Same for Haiku model |
| API call fails (network) | Show inline error below chat input: "Connection error. Try again." |
| API rate limited | Show: "Rate limit hit. Wait a few seconds." |
| No budget data in DB | System prompt includes note: "No budget data found for current month." AI responds accordingly |


---

## Settings Additions

Add a new **AI** section to `/settings`:

```
AI Settings
──────────────────────────────────────────────────
Default model          [GPT-4o Mini ▼]
Default mode           [Single ▼]
──────────────────────────────────────────────────
API keys are configured in .env (not stored here)
──────────────────────────────────────────────────
Token usage this month   1,243 tokens  (~$0.002)
Clear conversation history               [Clear]
```

**Token tracking logic:**

- Sum `tokens_used` from `ai_conversations` where `created_at` is in current month
- Show approximate cost: `(tokens / 1_000_000) * blended_rate`
- Blended rate: \$0.40/1M (rough average across both models)

---

## Phase 7 Build Order

```
Step 1  — Backend: ai router + /api/ai/chat for GPT-4o Mini (streaming)
Step 2  — Backend: add Claude Haiku to /api/ai/chat
Step 3  — Backend: /api/ai/compare endpoint (parallel streaming)
Step 4  — Backend: budgetContext builder (live DB → formatted string)
Step 5  — Backend: ai_conversations table + GET/DELETE conversation endpoints
Step 6  — Frontend: /assistant route + page shell + sidebar nav item
Step 7  — Frontend: Single mode UI — ChatMessage, useAIStream hook, input bar
Step 8  — Frontend: QuickActions component + "Can I afford?" prompt flow
Step 9  — Frontend: Compare mode — ComparePanels, side-by-side layout, "Use this" button
Step 10 — Frontend: ConversationHistory sidebar + Settings AI section
```


---

## Success Criteria

✅ `/assistant` loads and renders without errors
✅ Single mode streams GPT-4o Mini responses in real time
✅ Single mode streams Claude Haiku responses in real time
✅ Compare mode fires both API calls simultaneously, streams both panels
✅ Budget context is injected correctly (amounts match Budget page)
✅ Quick actions send correct pre-filled messages
✅ "Can I afford?" prompt collects item + amount before sending
✅ "Use this answer" in Compare mode saves answer and switches to Single
✅ Conversation history persists across page refreshes
✅ Deleting a conversation removes it from DB and sidebar
✅ Error states display correctly when API keys are missing
✅ Token usage counter updates in Settings after each query
✅ Prompt Generator (`/prompt`) still works — untouched
✅ Mobile layout stacks correctly in both Single and Compare modes

```

***
