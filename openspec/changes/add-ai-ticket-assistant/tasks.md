# AI Ticket Assistant - Implementation Tasks

## Overview

Estimated effort: 8-10 agent sessions
Parallelizable: Tasks marked with same letter can run in parallel

## Prerequisites

- [ ] Verify Gemini API is configured and working in aegis
- [ ] Verify knowledge base migration (016) is applied
- [ ] Verify AI chat migration (017) is applied

---

## Phase 1: Database & Core Infrastructure

### Task 1.1: Database Migration (A)
**Create `database/migrations/XXX_ai_ticket_assistant.sql`**

- [ ] Create `ai_ticket_suggestions` table
- [ ] Create `ai_agent_usage` table
- [ ] Create `ticket_priority_cache` table
- [ ] Add indexes
- [ ] Test migration up/down

**Validation**: Migration runs without errors, tables exist

### Task 1.2: AI Service Layer - Ticket Assistant (A)
**Create `lib/ai/ticket-assistant.ts`**

- [ ] Implement `generateReply(ticketId, userId)` function
  - Gather ticket context (subject, description, replies)
  - Search KB for relevant articles
  - Find similar resolved tickets
  - Call Gemini with assembled prompt
  - Return generated draft
- [ ] Implement `rephraseText(text, style, ticketId?)` function
  - Styles: professional, empathetic, technical, simpler
  - Return rephrased text
- [ ] Implement `getSuggestions(ticketId)` function
  - Return actions, KB articles, similar tickets, notes
- [ ] Implement `searchKBForTicket(ticketId)` function
  - Semantic search using ticket subject/description
  - Return top 5 matching articles

**Validation**: Unit tests for each function, manual testing with sample tickets

### Task 1.3: AI Service Layer - Prioritization (A)
**Create `lib/ai/prioritization.ts`**

- [ ] Implement `calculatePriorityScore(ticket, user)` function
  - SLA score (0-100)
  - Priority score (0-40)
  - Assignment score (0-20)
  - Age score (0-20)
  - Customer score (0-20)
  - Return total and breakdown
- [ ] Implement `getPrioritizedQueue(userId, filters)` function
  - Fetch open tickets based on filters
  - Calculate scores for each
  - Sort by score descending
  - Cache results
  - Return sorted list with reasons
- [ ] Implement `explainPriority(ticketId, score, breakdown)` function
  - Use AI to generate human-readable explanation
  - Return 1-2 sentence explanation

**Validation**: Unit tests, verify scoring matches expected behavior

---

## Phase 2: API Endpoints

### Task 2.1: Escalation API (B)
**Create `app/api/v1/support/escalate/route.ts`**

- [ ] POST handler
  - Validate session belongs to user
  - Call existing `create_ticket_from_chat()` function
  - Update chat session with resolution_status
  - Return ticket ID and number
- [ ] Add error handling for missing session, invalid data
- [ ] Log escalation in audit trail

**Validation**: Manual test escalation, verify ticket created with chat context

### Task 2.2: Ticket AI API (B)
**Create `app/api/v1/tickets/[id]/ai/route.ts`**

- [ ] POST handler for `generate_reply`
  - Verify user access to ticket
  - Call `generateReply()`
  - Log usage in `ai_agent_usage`
  - Return draft
- [ ] POST handler for `rephrase`
  - Verify user access
  - Call `rephraseText()`
  - Log usage
  - Return rephrased text
- [ ] GET handler for suggestions
  - Verify user access
  - Call `getSuggestions()`
  - Cache results
  - Return suggestions
- [ ] POST handler for `search_kb`
  - Verify user access
  - Call `searchKBForTicket()`
  - Return articles

**Validation**: API tests for each action, verify auth works

### Task 2.3: Prioritization API (B)
**Create `app/api/v1/tickets/prioritize/route.ts`**

- [ ] GET handler
  - Parse query params (assigned_to, status, limit)
  - Call `getPrioritizedQueue()`
  - Return recommended ticket and queue
- [ ] Add cache headers for performance
- [ ] Add rate limiting

**Validation**: API tests, verify prioritization logic

---

## Phase 3: User-Facing Support Chat

### Task 3.1: Simplify Support Chat UI (C)
**Modify `app/portal/support/page.tsx`**

- [ ] Remove multi-conversation sidebar
- [ ] Remove "New Conversation" button
- [ ] Add "Clear chat" button instead
- [ ] Update rate limit display to be clearer ("X messages this hour")
- [ ] Remove conversation history loading

**Validation**: Visual inspection, simpler UX

### Task 3.2: Add Escalation Flow (C)
**Modify `app/portal/support/page.tsx`**

- [ ] Add "Talk to a person" button in header
- [ ] Create escalation modal
  - Reason textarea
  - Submit button
  - Loading state
- [ ] Add `handleEscalate()` function
  - Call escalation API
  - Show success message
  - Disable further chat (escalated state)
- [ ] Load existing escalated conversation on mount
- [ ] Show "Waiting for response" state when escalated

**Validation**: Full escalation flow works, ticket appears in queue

### Task 3.3: Add Escalation Email Notification (C)
**Create/modify `lib/email.ts`**

- [ ] Add `sendEscalationNotification()` function
  - Notify admins of new escalation
  - Include ticket summary
- [ ] Call from escalation API
- [ ] Add user notification when ticket is replied to

**Validation**: Emails received, content is correct

---

## Phase 4: Agent Ticket View

### Task 4.1: AI Suggestion Panel Component (D)
**Create `components/TicketAIPanel.tsx`**

- [ ] Collapsible sections:
  - Suggested Actions
  - Related KB Articles
  - Similar Tickets
  - Customer Notes
- [ ] Fetch suggestions from API on mount
- [ ] Handle loading/error states
- [ ] Add "Refresh" button
- [ ] Style with Tailwind (dark theme for admin)

**Validation**: Component renders, data fetches correctly

### Task 4.2: AI Reply Composer Component (D)
**Create `components/TicketReplyComposer.tsx`**

- [ ] Textarea with basic formatting
- [ ] "Generate Reply" button
  - Shows loading state
  - Inserts draft into textarea
  - User can edit before sending
- [ ] "Rephrase" dropdown
  - Select style
  - Rephrases selected text or entire content
- [ ] "Insert KB" button
  - Opens KB search modal
  - Insert article snippet
- [ ] "Quick Replies" dropdown
  - Load from `chat_quick_replies` table
  - Insert with variable substitution
- [ ] Internal note toggle
- [ ] Send button

**Validation**: All buttons work, drafts are editable

### Task 4.3: Integrate into Ticket View (D)
**Modify `app/portal/tickets/[id]/page.tsx`** (or admin ticket view)

- [ ] Add TicketAIPanel as right sidebar
- [ ] Replace existing reply form with TicketReplyComposer
- [ ] Handle responsive layout (panel collapses on mobile)
- [ ] Add keyboard shortcuts (Cmd+G for generate)

**Validation**: Full ticket view works with AI features

---

## Phase 5: Dashboard & Prioritization

### Task 5.1: Prioritization Widget (E)
**Create `components/PrioritizationWidget.tsx`**

- [ ] "Your Next Ticket" hero card
  - Subject, priority badge
  - Primary reason
  - SLA countdown if applicable
  - "Open Ticket" button
- [ ] List of top 5 prioritized tickets
  - Ticket number, subject (truncated)
  - Score badge
  - Primary reason icon/text
- [ ] Refresh button
- [ ] "View Full Queue" link

**Validation**: Widget displays, updates on refresh

### Task 5.2: Integrate into Dashboard (E)
**Modify `app/portal/dashboard/page.tsx`** (or admin dashboard)

- [ ] Add PrioritizationWidget to dashboard layout
- [ ] Position appropriately (prominent but not overwhelming)
- [ ] Add user preference to show/hide widget

**Validation**: Widget appears on dashboard, recommendations are useful

### Task 5.3: Full Queue View (E)
**Create `app/portal/tickets/prioritized/page.tsx`**

- [ ] Full-page prioritized ticket list
- [ ] Filter by: assigned to me, unassigned, team, all
- [ ] Filter by status: open, pending, all
- [ ] Show score breakdown on hover/click
- [ ] Bulk actions (assign, change priority)

**Validation**: Full queue view works, filters function

---

## Phase 6: Polish & Metrics

### Task 6.1: Usage Analytics (F)
**Create analytics dashboard or add to admin metrics**

- [ ] AI usage by agent (requests, acceptance rate)
- [ ] AI resolution rate (how often AI suggestions are used)
- [ ] Popular KB articles from suggestions
- [ ] Average response time with/without AI

**Validation**: Metrics are accurate, dashboard displays

### Task 6.2: Feedback Collection (F)
**Add feedback mechanisms**

- [ ] "Was this helpful?" on AI-generated content
- [ ] Track in `ai_ticket_suggestions.was_helpful`
- [ ] Aggregate for improvement

**Validation**: Feedback is collected and stored

### Task 6.3: Documentation (F)
**Create user documentation**

- [ ] Agent guide: How to use AI features
- [ ] Admin guide: Configuring AI settings
- [ ] Add to existing docs structure

**Validation**: Documentation is complete and accurate

---

## Parallel Execution Plan

```
Session 1: Tasks 1.1, 1.2, 1.3 (Database & Core - Group A)
Session 2: Tasks 2.1, 2.2, 2.3 (APIs - Group B)
Session 3: Tasks 3.1, 3.2, 3.3 (Support Chat - Group C)
Session 4: Tasks 4.1, 4.2, 4.3 (Agent View - Group D)
Session 5: Tasks 5.1, 5.2, 5.3 (Dashboard - Group E)
Session 6: Tasks 6.1, 6.2, 6.3 (Polish - Group F)
```

Sessions 1-2 are sequential (APIs need core).
Sessions 3, 4, 5 can run in parallel after Session 2.
Session 6 is final polish after all features work.

---

## Acceptance Criteria

- [ ] User can escalate AI chat to ticket with one click
- [ ] Ticket includes full chat transcript and AI attempts
- [ ] Agent can generate AI reply in < 3 seconds
- [ ] Agent can rephrase selected text
- [ ] Suggestion panel shows relevant KB articles
- [ ] Suggestion panel shows similar resolved tickets
- [ ] Prioritization recommends appropriate next ticket
- [ ] SLA-breaching tickets are prioritized highest
- [ ] Email notifications sent on escalation and reply
- [ ] Usage tracked for analytics
