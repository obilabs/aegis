# Fix API Contracts Between Aegis and Aegis-web

## Summary

Critical fixes needed to align API contracts between Aegis telemetry service and Aegis-web heartbeat endpoint. Currently, telemetry data is NOT being received correctly due to payload structure mismatch.

## Problem Statement

### Issue 1: Payload Structure Mismatch (CRITICAL)

**Aegis sends FLAT structure:**
```typescript
{
  instance_id: "Aegis_xxx",
  version: "1.0.0",
  license_key: "lic_pro_xxx",
  user_count_range: "11-50",      // FLAT
  modules_enabled: ["google"],     // FLAT
  uptime_hours: 24,                // FLAT
  last_sync_status: "success",     // FLAT
  api_usage: {...},                // FLAT
  command_usage: {...},            // FLAT
  ui_actions: {...}                // FLAT
}
```

**Aegis-web expects NESTED structure:**
```typescript
{
  instance_id: "Aegis_xxx",
  version: "1.0.0",
  license_key: "lic_pro_xxx",
  metrics: {                       // NESTED!
    user_count_range: "11-50",
    modules_enabled: ["google"],
    uptime_hours: 24,
    last_sync_status: "success",
    api_usage: {...},
    command_usage: {...},
    ui_actions: {...}
  }
}
```

**Result:** All metrics are being stored as NULL because `body.metrics` is undefined.

### Issue 2: Missing License Validation Endpoint

The API contract specifies `POST /api/instances/validate` but this endpoint doesn't exist. Aegis needs this to:
- Validate license on startup
- Get feature entitlements (support_chat, priority_updates, etc.)
- Cache license state for offline operation

### Issue 3: User Count Range Mismatch

- Aegis buckets: `"1-10"`, `"11-50"`, `"51-100"`, `"101-500"`, `"501-1000"`, `"1000+"`
- Aegis-web dashboard expects: `"1-10"`, `"11-50"`, `"51-100"`, `"101-500"`, `"500+"`

The midpoint calculation in `updateDashboardStats` doesn't handle the new ranges.

## Proposed Solution

### Fix 1: Accept Both Flat and Nested Payloads

Update heartbeat endpoint to accept both formats for backward compatibility:

```typescript
// Accept both formats
const metrics = body.metrics || {
  user_count_range: body.user_count_range,
  modules_enabled: body.modules_enabled,
  uptime_hours: body.uptime_hours,
  last_sync_status: body.last_sync_status,
  api_usage: body.api_usage,
  command_usage: body.command_usage,
  ui_actions: body.ui_actions,
};
```

### Fix 2: Implement License Validation Endpoint

Create `POST /api/instances/validate` per the API contract:

```typescript
interface ValidateRequest {
  instance_id: string;
  license_key: string;
  version: string;
}

interface ValidateResponse {
  valid: boolean;
  plan: "community" | "starter" | "pro" | "msp";
  features: {
    support_chat: boolean;
    priority_updates: boolean;
    custom_domain: boolean;
    api_access: boolean;
  };
  expires_at: string | null;
  message?: string;
}
```

### Fix 3: Normalize User Count Ranges

Map the new ranges to the dashboard buckets:
- `"501-1000"` → treat as `"500+"`
- `"1000+"` → treat as `"500+"`

## Success Criteria

1. Heartbeats from Aegis are received and stored correctly
2. License validation works on startup
3. Feature flags are returned and can be applied by client
4. Dashboard shows accurate metrics
5. No breaking changes to existing API

## Scope

### In Scope
- Fix heartbeat payload parsing
- Create validate endpoint
- Normalize user count ranges
- Add API version header support

### Out of Scope
- Changes to Aegis (will be coordinated separately)
- Stripe integration for license management
- Instance provisioning

## Technical Approach

1. Update `/api/instances/heartbeat/route.ts` to accept both formats
2. Create `/api/instances/validate/route.ts`
3. Add license validation utility function
4. Update dashboard stats to handle new ranges
5. Add `X-Aegis-API-Version` header checking

## Files to Modify

1. `app/api/instances/heartbeat/route.ts` - Accept both formats
2. `app/api/instances/validate/route.ts` - NEW: License validation
3. `lib/license.ts` - NEW: License utilities
4. `docs/API_CONTRACTS.md` - Update with clarifications
