# Tasks: Registration & Licensing System

## Prerequisites
- [ ] Create Google Cloud OAuth credentials
- [ ] Create Stripe account and get API keys
- [ ] Get Google AI Studio API key (for Gemini)

---

## Phase 1: Authentication (Google OAuth)

### Task 1.1: Configure better-auth with Google Provider
**File:** `lib/auth.ts`

```typescript
import { betterAuth } from "better-auth"
import { Pool } from "pg"

export const auth = betterAuth({
  database: new Pool({
    connectionString: process.env.DATABASE_URL,
  }),
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
})
```

**Validation:**
- Sign in with Google redirects correctly
- Session persists across page loads
- Sign out clears session

### Task 1.2: Create Sign-In Page
**File:** `app/(pages)/signin/page.tsx`

Simple page with:
- "Sign in with Google" button
- Redirect to dashboard after auth

### Task 1.3: Add Environment Variables
**File:** `.env.example`

```
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_AI_API_KEY=
```

---

## Phase 2: Database Schema

### Task 2.1: Create Migration
**File:** `database/migrations/002_registration_licensing.sql`

```sql
-- Registered instances linked to users
CREATE TABLE registered_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,  -- better-auth user ID
  instance_id VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255),
  license_tier VARCHAR(20) DEFAULT 'community',
  registered_at TIMESTAMPTZ DEFAULT NOW(),
  last_heartbeat_at TIMESTAMPTZ,
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE CASCADE
);

CREATE INDEX idx_registered_instances_user ON registered_instances(user_id);
CREATE INDEX idx_registered_instances_instance ON registered_instances(instance_id);

-- Cloud waitlist
CREATE TABLE cloud_waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  email VARCHAR(255) NOT NULL,
  company_name VARCHAR(255),
  expected_users VARCHAR(20),
  use_case TEXT,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  notified_at TIMESTAMPTZ
);

CREATE INDEX idx_cloud_waitlist_email ON cloud_waitlist(email);

-- Donations
CREATE TABLE donations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  stripe_payment_id VARCHAR(255) UNIQUE,
  stripe_customer_id VARCHAR(255),
  amount_cents INTEGER NOT NULL,
  currency VARCHAR(3) DEFAULT 'CAD',
  is_recurring BOOLEAN DEFAULT FALSE,
  subscription_status VARCHAR(20),  -- 'active', 'canceled', etc.
  show_on_credits BOOLEAN DEFAULT FALSE,
  display_name VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Support conversations
CREATE TABLE support_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  instance_id UUID REFERENCES registered_instances(id) ON DELETE SET NULL,
  title VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES support_conversations(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_support_messages_conversation ON support_messages(conversation_id);
```

**Validation:**
- Run migration without errors
- Tables created with correct constraints

---

## Phase 3: Instance Registration

### Task 3.1: Registration API Endpoint
**File:** `app/api/instances/register/route.ts`

```typescript
// POST - Register instance to user account
// Request: { instance_id: string, name?: string }
// Response: { success: true, license_key: string }

// Generates license key: lic_community_{timestamp}_{signature}
// Links instance to authenticated user
```

### Task 3.2: List User's Instances
**File:** `app/api/instances/mine/route.ts`

```typescript
// GET - List all instances registered to current user
// Response: { instances: [...] }
```

### Task 3.3: Update Heartbeat Handler
**File:** `app/api/instances/heartbeat/route.ts`

Modify to:
- Update `last_heartbeat_at` on registered_instances
- Link anonymous heartbeats to registered instances when license_key matches

**Validation:**
- User can register new instance
- Instance appears in "my instances" list
- Heartbeats update last_heartbeat_at

---

## Phase 4: Cloud Waitlist

### Task 4.1: Join Waitlist API
**File:** `app/api/waitlist/join/route.ts`

```typescript
// POST - Join cloud waitlist
// Request: { email, company_name?, expected_users?, use_case? }
// Response: { success: true, position: number }
```

### Task 4.2: Waitlist Page
**File:** `app/(pages)/waitlist/page.tsx`

Form with:
- Email (required)
- Company name (optional)
- Expected users dropdown: "1-10", "11-50", "51-100", "100+"
- Use case textarea (optional)
- Submit button

**Validation:**
- Form submits successfully
- User sees confirmation with waitlist position
- Data stored in database

---

## Phase 5: Donations (Stripe)

### Task 5.1: Donation Checkout API
**File:** `app/api/donations/checkout/route.ts`

```typescript
// POST - Create Stripe checkout session
// Request: { amount_cents: number, is_recurring: boolean }
// Response: { checkout_url: string }
```

### Task 5.2: Stripe Webhook Handler
**File:** `app/api/donations/webhook/route.ts`

Handle events:
- `checkout.session.completed` → Record donation
- `customer.subscription.updated` → Update subscription status
- `customer.subscription.deleted` → Mark canceled

### Task 5.3: Donation Page
**File:** `app/(pages)/donate/page.tsx`

- Preset amounts: $5, $10, $25, $50, Custom
- Toggle: One-time / Monthly
- Optional: "Show my name on credits page"
- Stripe checkout redirect

### Task 5.4: Credits Page
**File:** `app/(pages)/credits/page.tsx`

- List supporters who opted to show name
- Grouped by tier (recurring vs one-time)
- No amounts shown (privacy)

**Validation:**
- Checkout redirects to Stripe
- Webhook records donation after payment
- Name appears on credits (if opted in)

---

## Phase 6: AI Support Bot

### Task 6.1: Gemini Integration
**File:** `lib/gemini.ts`

```typescript
import { GoogleGenerativeAI } from "@google/generative-ai"

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!)

export async function chat(
  systemPrompt: string,
  messages: { role: string; content: string }[]
) {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })
  // ... implementation
}
```

### Task 6.2: System Prompt with Documentation
**File:** `lib/support-prompt.ts`

Compile system prompt including:
- Aegis README
- Common setup steps
- Troubleshooting guide
- FAQ

### Task 6.3: Chat API Endpoint
**File:** `app/api/support/chat/route.ts`

```typescript
// POST - Send message to support bot
// Request: { conversation_id?: string, message: string }
// Response: { conversation_id, response: string }

// Rate limit: 20 messages/hour per user
// Requires authentication
```

### Task 6.4: Support Chat UI
**File:** `app/(pages)/support/page.tsx`

- Chat interface (messages list + input)
- Conversation history sidebar
- "Start new conversation" button
- Link to GitHub issues for escalation

**Validation:**
- Bot responds to questions accurately
- Conversation history persists
- Rate limiting works

---

## Phase 7: User Dashboard

### Task 7.1: Dashboard Page
**File:** `app/(pages)/dashboard/page.tsx`

Sections:
- **My Instances** - List with status, last heartbeat, register new
- **Support** - Recent conversations, start new
- **Donations** - History, manage recurring
- **Cloud Waitlist** - Status if joined

### Task 7.2: Navigation & Layout
**File:** `app/(pages)/layout.tsx`

- Header with user avatar, sign out
- Sidebar navigation
- Protected route (redirect to signin if not authed)

---

## Phase 8: Aegis Integration

### Task 8.1: Settings > About Enhancement
**File:** `frontend/src/pages/Settings/AboutTab.tsx` (Aegis)

Add:
- "Register this instance" button (links to Aegis-web)
- Display license tier and registration status
- Link to support bot

### Task 8.2: Registration Deep Link
When user clicks "Register", open:
```
https://api.obilabs.dev/register?instance_id=Aegis_xxx&version=1.0.0
```

Aegis-web pre-fills the form with instance details.

---

## Verification Checklist

### Authentication
- [ ] Google OAuth sign-in works
- [ ] Session persists correctly
- [ ] Sign out clears session
- [ ] Protected routes redirect to signin

### Instance Registration
- [ ] Can register instance from Aegis
- [ ] Instance shows in dashboard
- [ ] License key generated correctly
- [ ] Heartbeats update last_heartbeat_at

### Cloud Waitlist
- [ ] Form submits and stores data
- [ ] Waitlist position shown
- [ ] Duplicate email handled gracefully

### Donations
- [ ] Stripe checkout works
- [ ] Webhook records donation
- [ ] Credits page shows opted-in supporters
- [ ] Recurring donations tracked

### Support Bot
- [ ] Requires sign-in
- [ ] Rate limiting enforced
- [ ] Responses are helpful and accurate
- [ ] Conversation history works

---

## Environment Variables Summary

```env
# Google OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Google AI (Gemini)
GOOGLE_AI_API_KEY=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=

# Existing
DATABASE_URL=
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=
```

---

## Deployment Notes

1. Create Google Cloud OAuth credentials
   - Authorized redirect: `https://api.obilabs.dev/api/auth/callback/google`

2. Create Google AI Studio API key
   - Enable Gemini API

3. Create Stripe account
   - Get API keys
   - Configure webhook endpoint: `https://api.obilabs.dev/api/donations/webhook`

4. Run database migration

5. Deploy and test each phase
