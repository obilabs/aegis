# Tasks: Fix API Contracts

## Prerequisites
- [ ] Verify Aegis-web is running locally
- [ ] Have test instance ID ready for validation

---

## Task 1: Fix Heartbeat Payload Parsing (CRITICAL)

**File:** `app/api/instances/heartbeat/route.ts`

**Change:** Accept both flat and nested payload formats

```typescript
// Line ~39: Replace
const metrics = body.metrics || {}

// With
const metrics = body.metrics || {
  user_count_range: body.user_count_range,
  modules_enabled: body.modules_enabled,
  uptime_hours: body.uptime_hours,
  last_sync_status: body.last_sync_status,
  api_usage: body.api_usage,
  command_usage: body.command_usage,
  ui_actions: body.ui_actions,
}
```

**Validation:**
```bash
# Test with flat payload (what Aegis sends)
curl -X POST http://localhost:3000/api/instances/heartbeat \
  -H "Content-Type: application/json" \
  -d '{
    "instance_id": "Aegis_test123456789012",
    "version": "1.0.0",
    "user_count_range": "11-50",
    "modules_enabled": ["google-sync"],
    "uptime_hours": 24,
    "last_sync_status": "success"
  }'

# Verify data stored correctly
psql -c "SELECT * FROM instance_heartbeats ORDER BY received_at DESC LIMIT 1"
```

---

## Task 2: Create License Validation Endpoint

**File:** `app/api/instances/validate/route.ts` (NEW)

**Implementation:**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { validateLicenseKey, getLicenseFeatures } from '@/lib/license'
import { queryOne } from '@/lib/db'

interface ValidateRequest {
  instance_id: string
  license_key: string
  version: string
}

export async function POST(request: NextRequest) {
  try {
    const body: ValidateRequest = await request.json()

    // Validate required fields
    if (!body.instance_id || !body.license_key || !body.version) {
      return NextResponse.json({
        valid: false,
        plan: 'community',
        features: getLicenseFeatures('community'),
        expires_at: null,
        message: 'Missing required fields',
      })
    }

    // Check if license is suspended in database
    const instance = await queryOne(
      'SELECT plan, status FROM instances WHERE license_key = $1',
      [body.license_key]
    )

    if (instance?.status === 'suspended') {
      return NextResponse.json({
        valid: false,
        plan: 'community',
        features: getLicenseFeatures('community'),
        expires_at: null,
        message: 'License suspended. Please contact support.',
      })
    }

    // Validate license key signature
    const validation = validateLicenseKey(body.license_key)

    if (!validation.valid) {
      return NextResponse.json({
        valid: false,
        plan: 'community',
        features: getLicenseFeatures('community'),
        expires_at: null,
        message: validation.message || 'Invalid license key',
      })
    }

    // Return success with features
    return NextResponse.json({
      valid: true,
      plan: validation.plan,
      features: getLicenseFeatures(validation.plan),
      expires_at: null, // Subscription-based, no expiry
      message: 'License valid. Thank you for supporting Aegis!',
    })

  } catch (error) {
    console.error('Validate error:', error)
    return NextResponse.json({
      valid: false,
      plan: 'community',
      features: getLicenseFeatures('community'),
      expires_at: null,
      message: 'Validation service unavailable',
    }, { status: 500 })
  }
}
```

**Validation:**
```bash
# Test validation endpoint
curl -X POST http://localhost:3000/api/instances/validate \
  -H "Content-Type: application/json" \
  -d '{
    "instance_id": "Aegis_test123456789012",
    "license_key": "lic_pro_1704067200_a1b2c3d4e5f6",
    "version": "1.0.0"
  }'
```

---

## Task 3: Create License Utility Functions

**File:** `lib/license.ts` (NEW)

```typescript
import crypto from 'crypto'

type Plan = 'community' | 'starter' | 'pro' | 'msp'

interface Features {
  support_chat: boolean
  priority_updates: boolean
  custom_domain: boolean
  api_access: boolean
}

interface ValidationResult {
  valid: boolean
  plan: Plan
  message?: string
}

const FEATURE_MATRIX: Record<Plan, Features> = {
  community: {
    support_chat: false,
    priority_updates: false,
    custom_domain: false,
    api_access: true,
  },
  starter: {
    support_chat: false,
    priority_updates: true,
    custom_domain: false,
    api_access: true,
  },
  pro: {
    support_chat: true,
    priority_updates: true,
    custom_domain: true,
    api_access: true,
  },
  msp: {
    support_chat: true,
    priority_updates: true,
    custom_domain: true,
    api_access: true,
  },
}

export function getLicenseFeatures(plan: Plan): Features {
  return FEATURE_MATRIX[plan] || FEATURE_MATRIX.community
}

export function validateLicenseKey(key: string): ValidationResult {
  if (!key) {
    return { valid: false, plan: 'community', message: 'No license key provided' }
  }

  const parts = key.split('_')
  if (parts.length !== 4 || parts[0] !== 'lic') {
    return { valid: false, plan: 'community', message: 'Invalid license format' }
  }

  const [, plan, timestamp, signature] = parts

  // Validate plan
  if (!['starter', 'pro', 'msp'].includes(plan)) {
    return { valid: false, plan: 'community', message: 'Invalid plan in license' }
  }

  // Validate signature
  const secret = process.env.LICENSE_SECRET
  if (!secret) {
    console.error('LICENSE_SECRET not configured')
    return { valid: false, plan: 'community', message: 'License validation unavailable' }
  }

  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(`${plan}${timestamp}`)
    .digest('hex')
    .substring(0, 12)

  if (signature !== expectedSig) {
    return { valid: false, plan: 'community', message: 'Invalid license signature' }
  }

  return { valid: true, plan: plan as Plan }
}

export function generateLicenseKey(plan: Plan): string {
  const timestamp = Math.floor(Date.now() / 1000)
  const secret = process.env.LICENSE_SECRET

  if (!secret) {
    throw new Error('LICENSE_SECRET not configured')
  }

  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${plan}${timestamp}`)
    .digest('hex')
    .substring(0, 12)

  return `lic_${plan}_${timestamp}_${signature}`
}
```

---

## Task 4: Fix User Count Range Handling

**File:** `app/api/instances/heartbeat/route.ts`

**Update `updateDashboardStats` function:**

```typescript
// Line ~175: Update rangeToMidpoint
const rangeToMidpoint: Record<string, number> = {
  '1-10': 5,
  '11-50': 30,
  '51-100': 75,
  '101-500': 300,
  '501-1000': 750,  // NEW
  '1000+': 1500,    // NEW
  '500+': 750,      // Keep for backward compat
}
```

---

## Task 5: Add API Version Header Support

**File:** `app/api/instances/heartbeat/route.ts`

Add at the start of the POST handler:

```typescript
// Check API version for future compatibility
const apiVersion = request.headers.get('X-Aegis-API-Version') || '1'
console.log(`[Heartbeat] API Version: ${apiVersion}, Instance: ${body.instance_id}`)
```

---

## Task 6: Update API Contracts Documentation

**File:** `docs/API_CONTRACTS.md`

Add clarification about flat vs nested payload:

```markdown
### Payload Compatibility Note

Aegis-web accepts both flat and nested payload formats for backward compatibility:

**Flat format (legacy):**
```json
{
  "instance_id": "Aegis_xxx",
  "version": "1.0.0",
  "user_count_range": "11-50",
  "modules_enabled": ["google"]
}
```

**Nested format (preferred):**
```json
{
  "instance_id": "Aegis_xxx",
  "version": "1.0.0",
  "metrics": {
    "user_count_range": "11-50",
    "modules_enabled": ["google"]
  }
}
```
```

---

## Verification Checklist

- [ ] Heartbeat with flat payload works
- [ ] Heartbeat with nested payload works
- [ ] Metrics stored correctly in database
- [ ] License validation returns correct features
- [ ] Invalid license returns community features
- [ ] Dashboard stats update correctly
- [ ] No regression in existing functionality

---

## Deployment Steps

1. Deploy to staging
2. Test with mock Aegis heartbeat
3. Verify database records
4. Test license validation
5. Deploy to production
6. Monitor for errors in first hour
