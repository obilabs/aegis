# AI Stakeholder Access Control

## Problem
Different users need different AI experiences, data access, and prompts. A one-size-fits-all AI chat leaks information or provides irrelevant guidance.

## Stakeholder Matrix

| Stakeholder | AI Prompt Focus | KB Visibility | Data Access | Example Queries |
|-------------|----------------|---------------|-------------|-----------------|
| **Employee (end user)** | IT self-service, how-to guides | Public only | Own tickets, own assets | "How do I connect to VPN?", "Check my ticket status" |
| **Reporting Manager** | Team oversight, approvals | Public only | Own + direct reports' tickets, assets, onboarding status | "What assets does Sarah have?", "Any open tickets from my team?" |
| **HR** | Employee lifecycle, policies | Public + Internal | All contacts, onboarding/offboarding workflows, HR-tagged KB | "Start onboarding for new hire", "What's our PTO policy?" |
| **IT Technician** | Ticket resolution, troubleshooting | Public + Internal | All tickets, all assets, all contacts, internal KB | "Similar tickets to this VPN issue", "What's the resolution for error X?" |
| **IT Admin** | System config, audit, full access | Public + Internal + Private | Everything including settings, audit logs, provider config | "Show audit log for last 24h", "Which AI provider has most usage?" |
| **Leadership/CEO** | Metrics, compliance, strategic | Public + Internal | Aggregated metrics, compliance reports, SLA performance | "What's our average ticket resolution time?", "How many open critical tickets?" |
| **External (guest/contractor)** | Restricted or none | Public only (if allowed) | None or own tickets only | Should be gated by feature flag |
| **Provider (MSP)** | Cross-org support | All | Scoped by provider access grants | "Show all critical tickets across managed organizations" |

## Implementation Plan

### Phase 1: Role-Based Prompt Selection (Next Sprint)
- Add `ai_prompt_presets` table:
  ```sql
  CREATE TABLE ai_prompt_presets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id),
    name VARCHAR(100) NOT NULL,
    context_level VARCHAR(50) NOT NULL, -- end_user, manager, hr, technician, admin, leadership, external
    system_prompt TEXT NOT NULL,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  ```
- Map user role -> context_level at session time
- Select appropriate prompt preset when building AI system prompt

### Phase 2: Data Scoping per Context Level
- `end_user`: KB search WHERE visibility = 'public', tickets WHERE contact_id = user's contact
- `manager`: Same as end_user + tickets WHERE contact_id IN (direct_reports)
- `hr`: KB WHERE visibility IN ('public', 'internal') AND tags @> '{hr}', all contacts
- `technician`: KB WHERE visibility IN ('public', 'internal'), all tickets/assets
- `admin`: All KB including private, all data
- `leadership`: Aggregated data only (counts, averages, trends) — no individual ticket content
- `external`: Public KB only, own tickets only (if feature flag enabled)

### Phase 3: Triage Dashboard
- AI suggests: priority, category, assignment, related KB articles
- Support team reviews in queue: accept, modify + accept, reject
- Accepted triage decisions feed back into AI training data
- After confidence threshold reached, enable auto-triage with human oversight

### Phase 4: RBAC Integration
- Add `ai_access` permission to RBAC system
- Roles define which context_level a user gets
- Settings page to configure which roles have AI access
- Feature flag to enable/disable AI for external users

## Current State (What's Built)
- `lib/ai-chat-security.ts` has 4 context levels: end_user, technician, admin, provider
- AI chat currently ignores context levels — everyone gets same prompt
- KB search in AI always uses visibility IN ('public', 'internal')
- No data scoping by user role

## Quick Win (Do Now)
- Scope KB search by user role: end_user gets 'public' only, staff gets 'public' + 'internal'
- This prevents leaking internal KB articles to regular employees
