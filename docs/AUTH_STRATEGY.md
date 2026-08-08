# 🔐 Aegis Authentication Strategy

> **Purpose:** Define how users authenticate to aegis based on their relationship to the organization.

---

## Overview

Aegis supports multiple authentication methods to accommodate different user types:

| User Type | Primary Auth | Fallback |
|-----------|--------------|----------|
| **Internal Staff** | SCIM/SSO → Magic Link → Email/Password | - |
| **External Customers** | Magic Link → Social Login | Email/Password |
| **MSP/Providers** | API Key with Contract | - |

---

## User Classification

### Domain-Based Auto-Classification

Users are classified based on their email domain:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   User signs up with: john@acme.com                                        │
│                                                                             │
│   System checks organization_domains table:                                │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │ domain        │ domain_type │ verification_mode │ auto_classify_as │  │
│   ├───────────────┼─────────────┼───────────────────┼──────────────────┤  │
│   │ acme.com      │ internal    │ verified_only     │ employee         │  │
│   │ acme-corp.com │ internal    │ scim_only         │ employee         │  │
│   │ partner.co    │ trusted     │ open              │ partner          │  │
│   │ *             │ external    │ open              │ customer         │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│   Result: john@acme.com → employee (if pre-verified)                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Domain Types

| Type | Description | Example |
|------|-------------|---------|
| `internal` | Company-owned domains | acme.com, acme.co.uk |
| `trusted` | Partner/contractor domains | msp-partner.com |
| `external` | Customer/public domains | gmail.com, outlook.com |

### Verification Modes (for Internal Domains)

| Mode | Behavior | Use Case |
|------|----------|----------|
| `open` | Anyone with domain can sign up | Small teams, startups |
| `verified_only` | Must be added as contact first | Most organizations |
| `request` | Creates access request for admin | Controlled onboarding |
| `scim_only` | Only SCIM provisioning allowed | Enterprise with IdP |

---

## Authentication Flows

### Flow 1: Internal Staff (Recommended)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   ENTERPRISE PATH (SCIM + SSO)                                             │
│   ════════════════════════════                                             │
│                                                                             │
│   1. IT Admin configures SCIM in IdP (Okta, Azure AD, etc.)                │
│   2. IdP pushes users/groups to Aegis                                      │
│   3. User clicks "Sign in with SSO"                                        │
│   4. Redirected to IdP, authenticates                                      │
│   5. Redirected back to Aegis, session created                             │
│                                                                             │
│   Benefits:                                                                 │
│   • Automatic provisioning/deprovisioning                                  │
│   • Centralized access control                                             │
│   • No passwords in Aegis                                                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   STANDARD PATH (Magic Link)                                               │
│   ══════════════════════════                                               │
│                                                                             │
│   1. HR/IT adds employee as contact (john@acme.com)                        │
│   2. Employee visits Aegis login page                                      │
│   3. Enters email: john@acme.com                                           │
│   4. System checks: Is this email a verified contact?                      │
│      ├── YES → Send magic link                                             │
│      └── NO  → "Contact your IT admin for access"                          │
│   5. Employee clicks magic link in email                                   │
│   6. Session created, user logged in                                       │
│                                                                             │
│   Benefits:                                                                 │
│   • No password to remember                                                │
│   • IT controls who has access                                             │
│   • Simple for users                                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   FALLBACK PATH (Email/Password)                                           │
│   ══════════════════════════════                                           │
│                                                                             │
│   1. HR/IT adds employee as contact with "can_login" flag                  │
│   2. System sends invite email with password setup link                    │
│   3. Employee sets password                                                │
│   4. Employee logs in with email/password                                  │
│                                                                             │
│   Use when:                                                                 │
│   • Email delivery is unreliable                                           │
│   • User prefers traditional login                                         │
│   • Compliance requires password                                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Flow 2: External Customers

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   CUSTOMER SELF-SERVICE                                                    │
│   ═════════════════════                                                    │
│                                                                             │
│   1. Customer visits support portal                                        │
│   2. Clicks "Sign in" or "Create account"                                  │
│   3. Options:                                                              │
│      ├── Magic Link: Enter email, receive link                             │
│      ├── Social Login: Google, Microsoft, GitHub                           │
│      └── Email/Password: Traditional registration                          │
│   4. First login creates contact record (type: customer)                   │
│   5. Customer can submit tickets, view KB                                  │
│                                                                             │
│   Rate Limiting (anti-spam):                                               │
│   • 5 magic links per email per hour                                       │
│   • 10 registrations per IP per hour                                       │
│   • CAPTCHA after 3 failed attempts                                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Flow 3: MSP/Provider Access

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   PROVIDER API ACCESS                                                      │
│   ═══════════════════                                                      │
│                                                                             │
│   1. Client admin generates API key for MSP                                │
│   2. Client selects:                                                       │
│      ├── Contract type (Standard, Premium, Emergency)                      │
│      ├── Scopes (tickets:read, assets:write, etc.)                         │
│      └── Expiration (30 days, 90 days, 1 year)                             │
│   3. MSP acknowledges contract terms                                       │
│   4. API key activated                                                     │
│   5. All MSP actions logged with provider_id                               │
│                                                                             │
│   MSP uses API key in requests:                                            │
│   Authorization: Bearer aegis_msp_xxxxx                                    │
│                                                                             │
│   Key types:                                                               │
│   • aegis_msp_* → MSP/Provider access (logged, audited)                    │
│   • aegis_int_* → Integration access (automation)                          │
│   • aegis_usr_* → User personal access (scripts)                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Spam Prevention

### Tiered Verification System

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   INTERNAL DOMAINS (acme.com)                                              │
│   ═══════════════════════════                                              │
│                                                                             │
│   verification_mode: 'verified_only' (recommended)                         │
│                                                                             │
│   User tries to sign up with john@acme.com:                                │
│                                                                             │
│   1. Check: Is john@acme.com in contacts table?                            │
│      ├── YES → Allow magic link / password setup                           │
│      └── NO  → Show message:                                               │
│                "Your email isn't registered yet.                           │
│                 Please contact your IT administrator."                     │
│                                                                             │
│   This prevents:                                                           │
│   • Random people claiming to be employees                                 │
│   • Spam accounts on internal domains                                      │
│   • Unauthorized access                                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   EXTERNAL DOMAINS (gmail.com, etc.)                                       │
│   ════════════════════════════════                                         │
│                                                                             │
│   Rate limiting + CAPTCHA                                                  │
│                                                                             │
│   Limits:                                                                  │
│   • 5 magic links per email per hour                                       │
│   • 10 sign-ups per IP per hour                                            │
│   • 50 sign-ups per domain per day (for custom domains)                    │
│                                                                             │
│   CAPTCHA triggers:                                                        │
│   • After 3 failed login attempts                                          │
│   • When rate limit is 80% reached                                         │
│   • For suspicious patterns (rapid requests)                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Access Request Flow (Optional)

For organizations that want admin approval for new users:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   verification_mode: 'request'                                             │
│                                                                             │
│   1. User enters email: jane@acme.com                                      │
│   2. System: "Email not found. Request access?"                            │
│   3. User fills form: Name, Department, Reason                             │
│   4. Request created in user_access_requests table                         │
│   5. Admin notified (email + dashboard alert)                              │
│   6. Admin reviews:                                                        │
│      ├── Approve → Contact created, user notified                          │
│      └── Reject → User notified with reason                                │
│                                                                             │
│   Anti-spam for requests:                                                  │
│   • 1 request per email per 24 hours                                       │
│   • 10 requests per domain per day                                         │
│   • Auto-reject if email bounces                                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### organization_domains

```sql
CREATE TABLE organization_domains (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL,
    
    -- Domain info
    domain VARCHAR(255) NOT NULL,           -- e.g., "acme.com"
    domain_type VARCHAR(20) NOT NULL,       -- internal, trusted, external
    
    -- Verification
    verification_mode VARCHAR(20) DEFAULT 'verified_only',
    -- open: anyone can sign up
    -- verified_only: must be contact first
    -- request: creates access request
    -- scim_only: only SCIM provisioning
    
    -- Auto-classification
    auto_classify_as VARCHAR(20) DEFAULT 'employee',
    
    -- SCIM (enterprise)
    scim_enabled BOOLEAN DEFAULT false,
    scim_endpoint_url TEXT,
    scim_bearer_token_hash TEXT,
    
    -- SSO (enterprise)
    sso_enabled BOOLEAN DEFAULT false,
    sso_provider VARCHAR(50),               -- okta, azure_ad, google
    sso_config JSONB,
    
    -- Rate limiting
    max_signups_per_day INT DEFAULT 100,
    max_requests_per_day INT DEFAULT 50,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### user_access_requests

```sql
CREATE TABLE user_access_requests (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL,
    
    -- Request info
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    department VARCHAR(100),
    reason TEXT,
    
    -- Status
    status VARCHAR(20) DEFAULT 'pending',   -- pending, approved, rejected
    reviewed_by_id UUID,
    reviewed_at TIMESTAMPTZ,
    rejection_reason TEXT,
    
    -- Anti-spam
    ip_address INET,
    user_agent TEXT,
    
    -- Result
    created_contact_id UUID,                -- If approved
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Better Auth Configuration

```typescript
// lib/auth.ts
import { betterAuth } from 'better-auth';
import { magicLink } from 'better-auth/plugins/magic-link';
import { organization } from 'better-auth/plugins/organization';

export const auth = betterAuth({
  database: {
    provider: 'pg',
    url: process.env.DATABASE_URL,
  },
  
  // Email/Password (always available)
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
  },
  
  // Social Login (for external users)
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    },
    microsoft: {
      clientId: process.env.MICROSOFT_CLIENT_ID,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
    },
  },
  
  // Plugins
  plugins: [
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        // Check domain verification mode first
        const canSend = await checkDomainAccess(email);
        if (!canSend) {
          throw new Error('Email not authorized');
        }
        await sendEmail({
          to: email,
          subject: 'Sign in to Aegis',
          html: `<a href="${url}">Click here to sign in</a>`,
        });
      },
    }),
    organization(),
  ],
  
  // Hooks
  hooks: {
    before: {
      signUp: async ({ email }) => {
        // Verify domain allows sign-up
        const allowed = await checkSignUpAllowed(email);
        if (!allowed) {
          throw new Error('Sign-up not allowed for this domain');
        }
      },
    },
    after: {
      signUp: async ({ user }) => {
        // Auto-classify user based on domain
        await classifyAndLinkContact(user);
      },
    },
  },
});
```

---

## Implementation Checklist

### Phase 1: Core Auth (v1.0)

- [x] Email/Password authentication
- [x] Google Workspace login
- [ ] Magic link authentication
- [ ] Domain-based user classification
- [ ] Basic rate limiting

### Phase 2: Enterprise Auth (v1.5)

- [ ] SCIM provisioning
- [ ] SAML SSO
- [ ] OIDC SSO
- [ ] Access request workflow
- [ ] Advanced rate limiting

### Phase 3: Advanced (v2.0)

- [ ] MFA/2FA
- [ ] Hardware key support (WebAuthn)
- [ ] Session management UI
- [ ] Audit log for auth events

---

*Last Updated: February 2026*
