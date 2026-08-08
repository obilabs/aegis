# AI Ticket Assistant - Architecture Design

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend                                │
├─────────────────────────────────────────────────────────────────┤
│  SupportChat     │  TicketView      │  Dashboard                │
│  (User)          │  (Agent)         │  (Agent)                  │
│  ┌─────────────┐ │  ┌─────────────┐ │  ┌─────────────────────┐  │
│  │ AI Chat     │ │  │ AI Panel    │ │  │ Priority Widget     │  │
│  │ Escalate    │ │  │ Reply Gen   │ │  │ "Next Ticket"       │  │
│  └─────────────┘ │  │ Suggestions │ │  └─────────────────────┘  │
│                  │  └─────────────┘ │                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         API Layer                               │
├─────────────────────────────────────────────────────────────────┤
│  /api/v1/support/escalate   - Create ticket from chat           │
│  /api/v1/tickets/[id]/ai    - Reply generation, suggestions     │
│  /api/v1/tickets/prioritize - AI prioritization                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      AI Service Layer                           │
├─────────────────────────────────────────────────────────────────┤
│  lib/ai/ticket-assistant.ts                                     │
│  ├── generateReply(ticketId, options)                           │
│  ├── rephraseText(text, style)                                  │
│  ├── getSuggestions(ticketId)                                   │
│  └── searchKBForTicket(ticketId)                                │
│                                                                 │
│  lib/ai/prioritization.ts                                       │
│  ├── calculatePriorityScore(ticket, user)                       │
│  ├── getPrioritizedQueue(userId, filters)                       │
│  └── explainPriority(ticketId)                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      External Services                          │
├─────────────────────────────────────────────────────────────────┤
│  Gemini API         │  Knowledge Base      │  PostgreSQL        │
│  - Chat completion  │  - Vector search     │  - Tickets         │
│  - Embeddings       │  - Article retrieval │  - KB articles     │
│                     │                      │  - Chat sessions   │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow

### 1. Chat → Ticket Escalation

```
User clicks "Talk to a person"
       │
       ▼
┌─────────────────────────────────────┐
│ POST /api/v1/support/escalate       │
│ {                                   │
│   session_id: "chat-xxx",           │
│   reason: "User description...",    │
│   suggested_category: "network",    │
│   suggested_priority: "high"        │
│ }                                   │
└─────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│ create_ticket_from_chat()           │
│ - Creates ticket                    │
│ - Links to chat session             │
│ - Copies full transcript            │
│ - Records AI attempts               │
│ - Updates chat resolution_status    │
└─────────────────────────────────────┘
       │
       ▼
Ticket appears in IT queue with full context
```

### 2. AI Reply Generation

```
Agent clicks "Generate Reply"
       │
       ▼
┌─────────────────────────────────────┐
│ POST /api/v1/tickets/[id]/ai        │
│ { action: "generate_reply" }        │
└─────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│ Gather Context                      │
│ - Ticket subject, description       │
│ - All replies/comments              │
│ - Contact history                   │
│ - Related assets                    │
│ - Similar resolved tickets          │
└─────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│ Search Knowledge Base               │
│ - Semantic search on subject        │
│ - Match category tags               │
│ - Retrieve top 5 articles           │
└─────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│ Generate with Gemini                │
│ System: "You are IT support..."     │
│ Context: ticket + KB + history      │
│ Instruction: "Draft a helpful..."   │
└─────────────────────────────────────┘
       │
       ▼
Draft reply returned to composer
(Agent reviews, edits, sends)
```

### 3. Ticket Prioritization

```
Agent opens dashboard or clicks "Next Ticket"
       │
       ▼
┌─────────────────────────────────────┐
│ GET /api/v1/tickets/prioritize      │
│ ?assigned_to=me&status=open         │
└─────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│ Fetch Open Tickets                  │
│ - User's assignments                │
│ - Unassigned in user's teams        │
│ - Filter by status                  │
└─────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│ Calculate Priority Score            │
│ For each ticket:                    │
│ ┌─────────────────────────────────┐ │
│ │ SLA Score (0-100)               │ │
│ │ - 100 if breached               │ │
│ │ - 80 if < 1 hour                │ │
│ │ - 60 if < 4 hours               │ │
│ │ - 40 if < 24 hours              │ │
│ │ - 20 otherwise                  │ │
│ ├─────────────────────────────────┤ │
│ │ Priority Score (0-40)           │ │
│ │ - Critical: 40                  │ │
│ │ - High: 30                      │ │
│ │ - Medium: 20                    │ │
│ │ - Low: 10                       │ │
│ ├─────────────────────────────────┤ │
│ │ Assignment Score (0-20)         │ │
│ │ - Unassigned: 20                │ │
│ │ - Assigned to me: 15            │ │
│ │ - Assigned to team: 10          │ │
│ ├─────────────────────────────────┤ │
│ │ Age Score (0-20)                │ │
│ │ - > 7 days: 20                  │ │
│ │ - > 3 days: 15                  │ │
│ │ - > 1 day: 10                   │ │
│ │ - < 1 day: 5                    │ │
│ ├─────────────────────────────────┤ │
│ │ Customer Score (0-20)           │ │
│ │ - VIP/Executive: 20             │ │
│ │ - Repeat issue: 15              │ │
│ │ - First contact: 10             │ │
│ └─────────────────────────────────┘ │
│                                     │
│ Total: 0-200                        │
└─────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│ Generate Explanations               │
│ Use AI to explain why top tickets   │
│ are prioritized                     │
└─────────────────────────────────────┘
       │
       ▼
Return sorted queue with reasons
```

## Database Schema Additions

```sql
-- Migration: XXX_ai_ticket_assistant.sql

-- AI-generated content tracking
CREATE TABLE IF NOT EXISTS ai_ticket_suggestions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,

    suggestion_type VARCHAR(50), -- reply, action, kb_article, similar_ticket
    content TEXT,
    confidence DECIMAL(3,2), -- 0.00 to 1.00

    -- Source tracking
    source_type VARCHAR(50), -- gemini, kb_search, ticket_match
    source_references JSONB, -- article IDs, ticket IDs, etc.

    -- User feedback
    was_used BOOLEAN,
    was_helpful BOOLEAN,
    user_feedback TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Agent AI usage tracking
CREATE TABLE IF NOT EXISTS ai_agent_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ticket_id UUID REFERENCES tickets(id) ON DELETE SET NULL,

    action_type VARCHAR(50), -- generate_reply, rephrase, search_kb, prioritize
    input_tokens INT,
    output_tokens INT,

    -- Quality tracking
    was_accepted BOOLEAN, -- Did agent use the AI output?
    modifications_made TEXT, -- What did they change?

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Priority cache (for performance)
CREATE TABLE IF NOT EXISTS ticket_priority_cache (
    ticket_id UUID PRIMARY KEY REFERENCES tickets(id) ON DELETE CASCADE,

    priority_score INT,
    score_breakdown JSONB,
    reasons TEXT[],

    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '5 minutes'
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_ai_suggestions_ticket ON ai_ticket_suggestions(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ai_suggestions_type ON ai_ticket_suggestions(suggestion_type);
CREATE INDEX IF NOT EXISTS idx_ai_agent_usage_user ON ai_agent_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_priority_cache_expires ON ticket_priority_cache(expires_at);
```

## AI Prompt Templates

### Reply Generation

```
You are an IT support agent responding to a support ticket.

TICKET INFORMATION:
Subject: {{subject}}
Priority: {{priority}}
Category: {{category}}
Submitted by: {{contact_name}} ({{contact_email}})

TICKET DESCRIPTION:
{{description}}

CONVERSATION HISTORY:
{{replies}}

RELEVANT KNOWLEDGE BASE ARTICLES:
{{kb_articles}}

SIMILAR RESOLVED TICKETS:
{{similar_tickets}}

CUSTOMER CONTEXT:
- Previous tickets: {{previous_ticket_count}}
- Common issues: {{common_issues}}
- Assets: {{assets}}

INSTRUCTIONS:
1. Draft a helpful, professional response to this ticket
2. Reference knowledge base articles when applicable
3. Provide clear next steps or resolution
4. Match the tone of the organization (professional but friendly)
5. If more information is needed, ask specific questions

Format your response as you would send it directly to the customer.
Do not include internal notes or meta-commentary.
```

### Suggestion Generation

```
You are an IT support assistant analyzing a ticket.

TICKET:
{{ticket_summary}}

KNOWLEDGE BASE MATCHES:
{{kb_matches}}

SIMILAR TICKETS:
{{similar_tickets}}

Generate actionable suggestions for the IT agent. Return JSON:

{
  "actions": [
    { "action": "description", "reason": "why", "confidence": 0.8 }
  ],
  "kb_articles": [
    { "article_id": "xxx", "title": "...", "relevance": "why helpful" }
  ],
  "similar_tickets": [
    { "ticket_id": "xxx", "subject": "...", "resolution": "..." }
  ],
  "notes": [
    "Any important context the agent should know"
  ]
}
```

### Priority Explanation

```
Explain why this ticket should be prioritized.

TICKET: {{subject}}
SCORE: {{score}} / 200

BREAKDOWN:
- SLA: {{sla_score}} ({{sla_reason}})
- Priority: {{priority_score}} ({{priority_level}})
- Assignment: {{assignment_score}} ({{assignment_status}})
- Age: {{age_score}} ({{age_days}} days old)
- Customer: {{customer_score}} ({{customer_type}})

Write a concise 1-2 sentence explanation for why this ticket should be worked next.
Focus on the most important factors.
```

## Component Structure

### TicketAIPanel.tsx

```tsx
interface TicketAIPanelProps {
  ticketId: string;
}

// Sections:
// - Suggested Actions (collapsible)
// - Related KB Articles (collapsible)
// - Similar Tickets (collapsible)
// - Customer Notes (collapsible)

// Each section fetches on mount or when ticket changes
// Uses SWR for caching and revalidation
```

### TicketReplyComposer.tsx

```tsx
interface TicketReplyComposerProps {
  ticketId: string;
  onSend: (content: string, isInternal: boolean) => void;
}

// Features:
// - Textarea with formatting toolbar
// - "Generate Reply" button → calls AI API
// - "Rephrase" dropdown (professional, empathetic, technical, simpler)
// - "Insert KB" → search and insert article snippets
// - "Quick Replies" → canned response picker
// - Internal note toggle
```

### PrioritizationWidget.tsx

```tsx
interface PrioritizationWidgetProps {
  userId: string;
  maxItems?: number;
}

// Features:
// - "Your Next Ticket" hero card with top recommendation
// - List of top 5 prioritized tickets
// - Each item shows: subject, score, primary reason
// - Click to open ticket
// - Refresh button
// - "View All" link to full queue
```

## API Contracts

### POST /api/v1/support/escalate

```typescript
// Request
interface EscalateRequest {
  session_id: string;
  reason: string;
}

// Response
interface EscalateResponse {
  success: boolean;
  data: {
    ticket_id: string;
    ticket_number: string;
    message: string;
  };
}
```

### POST /api/v1/tickets/[id]/ai

```typescript
// Request
interface TicketAIRequest {
  action: 'generate_reply' | 'rephrase' | 'get_suggestions' | 'search_kb';
  text?: string; // For rephrase
  style?: 'professional' | 'empathetic' | 'technical' | 'simpler'; // For rephrase
}

// Response
interface TicketAIResponse {
  success: boolean;
  data: {
    content?: string; // For generate_reply, rephrase
    suggestions?: AISuggestions; // For get_suggestions
    articles?: KBArticle[]; // For search_kb
  };
}

interface AISuggestions {
  actions: { action: string; reason: string; confidence: number }[];
  kb_articles: { article_id: string; title: string; relevance: string }[];
  similar_tickets: { ticket_id: string; subject: string; resolution: string }[];
  notes: string[];
}
```

### GET /api/v1/tickets/prioritize

```typescript
// Query params
interface PrioritizeQuery {
  assigned_to?: 'me' | 'team' | 'unassigned' | 'all';
  status?: 'open' | 'pending' | 'all';
  limit?: number;
}

// Response
interface PrioritizeResponse {
  success: boolean;
  data: {
    recommended: PrioritizedTicket;
    queue: PrioritizedTicket[];
  };
}

interface PrioritizedTicket {
  ticket_id: string;
  ticket_number: string;
  subject: string;
  priority: string;
  score: number;
  reasons: string[];
  sla_status: 'ok' | 'warning' | 'breached';
  due_at: string | null;
}
```

## Performance Considerations

1. **Suggestion Caching**: Cache AI suggestions per ticket for 5 minutes
2. **Priority Caching**: Cache priority scores for 5 minutes
3. **KB Search**: Use embeddings for semantic search, cache results
4. **Parallel Requests**: Fetch suggestions, KB articles, and similar tickets in parallel
5. **Streaming**: Consider streaming for reply generation to show progress
6. **Rate Limiting**: Limit AI calls per user to prevent abuse

## Security Considerations

1. **Authorization**: Verify user has access to ticket before AI operations
2. **Content Filtering**: Ensure AI doesn't expose internal notes to external users
3. **Audit Trail**: Log all AI operations for compliance
4. **Input Sanitization**: Sanitize ticket content before sending to Gemini
5. **Output Validation**: Validate AI responses before displaying
