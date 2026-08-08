# Phase 6: Operational Workflow Features

## 6.1 Resolution Notes (Structured)

### Purpose
When a ticket is resolved/closed, capture structured resolution data for AI learning and pattern detection.

### Schema
```sql
-- Add to tickets table
ALTER TABLE tickets ADD COLUMN root_cause TEXT;
ALTER TABLE tickets ADD COLUMN resolution_steps TEXT;
ALTER TABLE tickets ADD COLUMN resolution_category VARCHAR(50); -- e.g., 'config_change', 'hardware_replacement', 'user_error', 'software_bug', 'access_issue'
```

### UI
- When status changes to "Resolved" or "Closed", show a resolution modal
- Two text fields: "What was the problem?" (root_cause) and "How was it fixed?" (resolution_steps)
- Optional category dropdown for classification
- Can skip but encouraged (show completion %)

### AI Integration
- Feed root_cause + resolution_steps into similar ticket suggestions
- AI chat can reference: "Similar tickets were resolved by: [resolution_steps]"
- Article generation uses structured resolution data for better quality
- Pattern detection: group tickets by root_cause category

---

## 6.2 Ticket Tasks (Checklist)

### Purpose
Steps needed to resolve a ticket. Not standalone work — tied to a ticket.

### Schema
```sql
CREATE TABLE ticket_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  title VARCHAR(255) NOT NULL,
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES users(id),
  sort_order INTEGER DEFAULT 0,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### UI
- Checklist in ticket detail page (below description, above conversation)
- Add task inline (text input + Enter)
- Click to toggle complete
- Drag to reorder
- Progress bar showing X/Y completed

---

## 6.3 Quick Notes & Tasks (Personal)

### Purpose
Lightweight scratchpad for support staff. Not tied to any ticket.

### Caps
- **10 active notes** per user
- **10 active tasks** per user
- At 5+ items: gentle nudge — "Consider moving older items to a ticket or backlog"
- At 10 items: block creation — "Move or archive something first"

### Schema
```sql
CREATE TABLE user_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  user_id UUID NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  is_archived BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  user_id UUID NOT NULL REFERENCES users(id),
  title VARCHAR(255) NOT NULL,
  is_completed BOOLEAN DEFAULT false,
  is_archived BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### UI
- Sidebar widget or collapsible panel (always accessible)
- Notes: simple text cards, edit inline, archive
- Tasks: checklist with toggle, archive when done
- Warning banner at 5+ items
- Block + migration prompt at 10 items
- "Convert to Ticket" and "Move to Backlog" actions on each item

---

## 6.4 Team Backlog

### Purpose
Pre-work ideas and improvement initiatives. Not customer-facing. Not SLA-tracked.
Feeds into the ticket/project system when ready.

### Flow
```
Backlog → Planning → Converted (linked to Ticket/Project) → Done / Aborted
```

- **Backlog**: Raw idea. Title, description, category, submitted_by.
- **Planning**: Being refined/scoped. Team discussion. Can add notes.
- **Converted**: Linked to a real ticket or project. Read-only status mirrors linked item.
- **Done**: Auto-set when linked ticket/project resolves. Not manually settable.
- **Aborted**: Requires reason. Options: won't fix, duplicate, no longer relevant, out of scope.

### Schema
```sql
CREATE TABLE team_backlog_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  team_id UUID REFERENCES teams(id),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  status VARCHAR(20) NOT NULL DEFAULT 'backlog', -- backlog, planning, converted, done, aborted
  priority VARCHAR(20) DEFAULT 'medium', -- low, medium, high
  submitted_by UUID REFERENCES users(id),
  -- Review reminder (not a deadline)
  review_by TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
  -- Conversion tracking
  converted_ticket_id UUID REFERENCES tickets(id),
  -- Abort tracking
  abort_reason VARCHAR(50), -- wont_fix, duplicate, no_longer_relevant, out_of_scope
  abort_notes TEXT,
  aborted_by UUID REFERENCES users(id),
  aborted_at TIMESTAMPTZ,
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE backlog_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  backlog_item_id UUID NOT NULL REFERENCES team_backlog_items(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### No SLA Tracking
- No first response time, no resolution clock
- Just age and review_by reminders
- review_by shows amber at due date, red when overdue

### Metrics Dashboard
- Items by status (funnel: backlog → planning → converted → done/aborted)
- Average age in backlog before conversion
- Conversion rate: converted / (converted + aborted)
- Abort rate with top reasons
- Items overdue for review (count + clickable list)
- Trend: items created vs resolved per week/month

### UI
- Kanban board (default view) — one board per team
- Drag between columns: Backlog ↔ Planning
- "Convert to Ticket" button on Planning items
- Done column auto-populates when linked tickets resolve
- Aborted items go to a separate "Aborted" tab (not on board)
- Click card to expand: description, comments, review_by picker
- Filter by category, priority, submitted_by

---

## Implementation Order

1. **6.1 Resolution Notes** — Highest leverage. Feeds AI learning immediately.
2. **6.2 Ticket Tasks** — Natural extension of ticket detail page.
3. **6.3 Quick Notes/Tasks** — Personal productivity for support staff.
4. **6.4 Team Backlog** — Largest scope. Build after core workflow is solid.

## Dependencies
- 6.1 has no dependencies (just adds fields to tickets)
- 6.2 depends on nothing new
- 6.3 needs a sidebar/panel component
- 6.4 needs the `teams` table (already exists in schema)
