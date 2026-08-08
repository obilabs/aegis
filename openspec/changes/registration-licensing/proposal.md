# Registration & Licensing System

## Summary

Implement a registration and licensing system for Aegis-web that allows users to:
- Register their Aegis instances
- Sign in with Google (social auth)
- Access AI support bot (Gemini-powered)
- Join Cloud tier waitlist
- Make donations (Supporter tier)

## Problem Statement

Currently:
- No way to track who is using Aegis
- No communication channel with users for updates/security notices
- No way to gauge demand for Cloud hosting
- No donation mechanism

## License Tiers

### Community (Free - Default)
- All features, forever free
- Self-hosted by user
- AI support bot access (requires sign-in)
- GitHub issues for complex problems
- Optional: Register for update notifications

### Supporter (Donation)
- Same features as Community
- One-time or recurring donation via Stripe
- Optional recognition on credits page
- Good karma

### Cloud (Waitlist - Coming Soon)
- We host instance for user
- Waitlist captures business info
- Will launch only if sufficient demand (10+ waitlist)
- Pricing TBD based on infrastructure costs

## Authentication

### Social Sign-In (Google OAuth)
- Primary auth method for Aegis-web
- Uses better-auth (already in project)
- Users sign in with Google account
- Links to their registered Aegis instances

### Why Require Sign-In for Support Bot?
1. Prevents abuse (rate limiting per user)
2. Tracks conversation history (better support)
3. Links questions to their instance context
4. Required for waitlist and donations anyway

## Technical Approach

### 1. Google OAuth Setup
- Configure better-auth with Google provider
- Callback URL: `https://api.obilabs.dev/api/auth/callback/google`
- Scopes: email, profile (minimal)

### 2. Database Schema (Aegis-web)
```sql
-- Users (better-auth manages this)
-- accounts (better-auth manages OAuth links)

-- Registered instances linked to users
CREATE TABLE registered_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  instance_id VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255),  -- User-friendly name
  license_tier VARCHAR(20) DEFAULT 'community',
  registered_at TIMESTAMPTZ DEFAULT NOW(),
  last_heartbeat_at TIMESTAMPTZ
);

-- Cloud waitlist
CREATE TABLE cloud_waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  company_name VARCHAR(255),
  expected_users VARCHAR(20),  -- "1-10", "11-50", etc.
  use_case TEXT,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  notified_at TIMESTAMPTZ  -- When we notified them of launch
);

-- Donations
CREATE TABLE donations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  stripe_payment_id VARCHAR(255),
  amount_cents INTEGER NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  is_recurring BOOLEAN DEFAULT FALSE,
  show_on_credits BOOLEAN DEFAULT FALSE,
  display_name VARCHAR(255),  -- Optional public name
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Support bot conversations
CREATE TABLE support_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  instance_id UUID REFERENCES registered_instances(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES support_conversations(id),
  role VARCHAR(20) NOT NULL,  -- 'user' | 'assistant'
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3. API Endpoints

```
Authentication (better-auth handles):
GET  /api/auth/signin/google    → Redirect to Google OAuth
GET  /api/auth/callback/google  → Handle OAuth callback
GET  /api/auth/session          → Get current session
POST /api/auth/signout          → Sign out

Instance Registration:
POST /api/instances/register    → Register instance to user account
GET  /api/instances/mine        → List user's registered instances
DELETE /api/instances/:id       → Unregister instance

Cloud Waitlist:
POST /api/waitlist/join         → Join cloud waitlist
GET  /api/waitlist/status       → Check waitlist position

Donations:
POST /api/donations/checkout    → Create Stripe checkout session
POST /api/donations/webhook     → Stripe webhook handler
GET  /api/donations/history     → User's donation history

Support Bot:
POST /api/support/chat          → Send message, get AI response
GET  /api/support/conversations → List user's conversations
GET  /api/support/conversation/:id → Get conversation history
```

### 4. Support Bot Architecture

```
┌─────────────────────────────────────────────────────┐
│  User (signed in)                                   │
│  "How do I configure Google Workspace?"             │
└─────────────────────────┬───────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────┐
│  /api/support/chat                                  │
│  1. Verify user is signed in                        │
│  2. Rate limit: 20 messages/hour                    │
│  3. Load context (user's instances, previous chat)  │
└─────────────────────────┬───────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────┐
│  Gemini API (via Google AI Studio or Vertex)        │
│                                                     │
│  System prompt includes:                            │
│  - Aegis documentation                      │
│  - Common troubleshooting steps                     │
│  - Links to relevant docs/code                      │
│  - User's instance context (version, modules)       │
└─────────────────────────┬───────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────┐
│  Response saved to support_messages                 │
│  Returned to user                                   │
└─────────────────────────────────────────────────────┘
```

### 5. Frontend Pages (Aegis-web)

```
/                       → Marketing homepage
/signin                 → Google sign-in button
/dashboard              → User dashboard (after sign-in)
  - Registered instances
  - Support conversations
  - Donation history
/support                → AI support bot chat interface
/waitlist               → Cloud waitlist form
/donate                 → Donation page (Stripe)
/credits                → Public credits page (supporters)
```

## Success Criteria

1. Users can sign in with Google account
2. Users can register their Aegis instances
3. AI support bot answers common questions accurately
4. Cloud waitlist captures business info
5. Donations work via Stripe
6. Credits page shows supporters (who opted in)

## Out of Scope

- Cloud hosting provisioning (waitlist only)
- Support hours tracking/billing
- Managed tier
- Email/password auth (Google only for simplicity)

## Security Considerations

1. OAuth tokens stored securely by better-auth
2. Rate limiting on support bot (prevent abuse)
3. Instance registration requires valid instance_id format
4. Stripe webhooks verified with signature
5. No PII exposed in credits page without consent

## Files to Create/Modify

### Aegis-web (new files)
- `lib/auth.ts` - Add Google provider config
- `app/api/instances/register/route.ts`
- `app/api/instances/mine/route.ts`
- `app/api/waitlist/join/route.ts`
- `app/api/donations/checkout/route.ts`
- `app/api/donations/webhook/route.ts`
- `app/api/support/chat/route.ts`
- `app/(pages)/dashboard/page.tsx`
- `app/(pages)/support/page.tsx`
- `app/(pages)/waitlist/page.tsx`
- `app/(pages)/donate/page.tsx`
- `app/(pages)/credits/page.tsx`

### Aegis (modifications)
- Add "Register Instance" button in Settings > About
- Display license tier and registration status
- Link to support bot

## Dependencies

- better-auth (already installed)
- Stripe SDK (already installed)
- Google AI SDK (@google/generative-ai) - NEW
- Google OAuth credentials (need to create)
