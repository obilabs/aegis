# Add AI Ticket Assistant

## Summary

Integrate AI-first support across the Aegis ITSM platform, enabling:
1. **User support chat → ticket escalation** with full context preservation
2. **AI-assisted replies** for IT agents (suggestions, rephrase, full reply generation from KB + ticket context)
3. **Smart suggestion panel** with actionable next steps on current ticket
4. **AI ticket prioritization** to help agents focus on what matters most

## Problem Statement

### Current State

The database schema already has comprehensive AI infrastructure:
- `ai_chat_sessions` with `chat_type` (user_support, admin_support, general)
- `chat_handoffs` for escalation tracking
- `chat_ticket_conversions` linking chats to tickets
- `ai_actions` for KB search, ticket creation, etc.
- `create_ticket_from_chat()` PostgreSQL function

**However, none of this is wired up in the UI/API yet.**

### User Problems

1. **End users** can chat with AI but cannot easily escalate to a real ticket when AI can't help
2. **IT agents** spend significant time writing replies, even for common issues with KB articles
3. **IT agents** have no AI assistance when working tickets - they must manually search KB, craft responses
4. **IT agents** must manually prioritize their queue, often missing SLA deadlines or urgent issues
5. **Ticket context** is lost when users submit tickets manually instead of through AI chat

## Proposed Solution

### Component 1: User Support Chat → Ticket Escalation

Simplify the user support page (remove multi-conversation complexity) and add "Talk to a person" which creates a real ticket:

```
User → AI Chat → Can't resolve → "Talk to a person" → Creates Ticket → IT Queue
```

The ticket includes:
- Full chat transcript
- AI's attempted solutions
- User's description of why AI couldn't help
- Suggested category/priority from AI

### Component 2: AI-Assisted Replies for Agents

When viewing a ticket, agents can:

1. **Generate Reply** - AI drafts a response based on:
   - Ticket subject/description
   - Full conversation history
   - Relevant KB articles
   - Similar resolved tickets
   - Customer context (past tickets, assets)

2. **Rephrase** - Rewrite selected text to be:
   - More professional
   - More empathetic
   - More technical
   - Simpler/clearer

3. **Search KB** - AI searches knowledge base and inserts relevant snippets

4. **Insert Quick Reply** - Canned responses with variable substitution

### Component 3: Smart Suggestion Panel

Right sidebar on ticket view showing:

```
┌─────────────────────────────┐
│ AI Suggestions              │
├─────────────────────────────┤
│ 📋 Suggested Actions:       │
│ • Assign to Network Team    │
│ • Request VPN logs          │
│ • Check asset #1234 status  │
├─────────────────────────────┤
│ 📚 Related KB Articles:     │
│ • VPN Troubleshooting Guide │
│ • Network Access Policy     │
├─────────────────────────────┤
│ 🎫 Similar Tickets:         │
│ • TKT-1234 (resolved)       │
│ • TKT-1456 (resolved)       │
├─────────────────────────────┤
│ ⚠️ Notes:                   │
│ • User had 3 VPN issues     │
│   in the past month         │
│ • Consider hardware check   │
└─────────────────────────────┘
```

### Component 4: AI Ticket Prioritization

Dashboard widget and API for "What should I work on next?"

**Factors considered:**
- SLA breach risk (time until due)
- Priority level (critical > high > medium > low)
- Assignment (unassigned vs assigned to me vs assigned to others)
- Customer importance (VIP contacts, executive tickets)
- Ticket age (older tickets shouldn't be forgotten)
- Complexity estimate (simple issues first for quick wins, or hard issues for focus time)
- Related tickets (batch similar issues together)

**Output:**
```json
{
  "recommended_ticket": "TKT-1234",
  "reason": "Critical priority, SLA breach in 2 hours, matches your recent VPN resolutions",
  "queue": [
    { "ticket_id": "TKT-1234", "score": 95, "reasons": ["SLA breach imminent", "Critical priority"] },
    { "ticket_id": "TKT-1567", "score": 78, "reasons": ["Unassigned", "VIP customer"] },
    { "ticket_id": "TKT-1890", "score": 65, "reasons": ["Your assignment", "Quick resolution likely"] }
  ]
}
```

## Success Criteria

1. Users can escalate AI chat to a ticket with one click
2. Full chat context is preserved in ticket
3. Agents can generate AI-assisted replies in < 2 seconds
4. Suggestion panel loads within 1 second of opening ticket
5. AI prioritization considers SLA and recommends accurate next ticket
6. Agent satisfaction with AI assistance > 80%
7. Average ticket resolution time decreases by 15%

## Scope

### In Scope

- User support chat simplification
- "Talk to a person" → ticket creation
- AI reply generation API
- Rephrase functionality
- Suggestion panel UI
- Ticket prioritization API
- Dashboard "next ticket" widget

### Out of Scope

- Chat handoff to live agents (future: real-time agent chat)
- AI auto-resolution without human (always creates ticket when escalating)
- Training custom models (uses Gemini with knowledge base context)
- Email-based ticket AI (focus on portal first)

## Technical Approach

See `design.md` for detailed architecture.

## Files to Create/Modify

### New Files

```
app/api/v1/tickets/[id]/ai/route.ts          - AI reply generation, suggestions
app/api/v1/tickets/prioritize/route.ts       - AI prioritization API
app/api/v1/support/escalate/route.ts         - Escalate chat to ticket
components/TicketAIPanel.tsx                  - Right sidebar suggestions
components/TicketReplyComposer.tsx            - AI-assisted reply editor
components/PrioritizationWidget.tsx           - "Next ticket" dashboard widget
lib/ai/ticket-assistant.ts                    - Core AI logic
lib/ai/prioritization.ts                      - Prioritization scoring
```

### Modified Files

```
app/portal/support/page.tsx                   - Simplify, add escalation
app/portal/tickets/[id]/page.tsx              - Add AI panel, reply composer
app/portal/dashboard/page.tsx                 - Add prioritization widget
database/migrations/XXX_ai_ticket_assistant.sql - Additional schema
```

## Dependencies

- Gemini API (already configured)
- Knowledge base system (migration 016, already exists)
- Ticket system (migration 002, already exists)
- AI chat system (migration 017, already exists)
