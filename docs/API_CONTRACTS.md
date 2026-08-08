# API Contracts

API contracts between Aegis and Aegis-web.

**Do not change these APIs without coordination** - they are called by deployed instances.

## Endpoints

| Endpoint | Purpose | Direction |
|----------|---------|-----------|
| `POST /api/instances/heartbeat` | Health check and telemetry | client -> web |
| `POST /api/instances/validate` | License validation | client -> web |

---

## Heartbeat

**Purpose:** Health monitoring and anonymous usage stats
**Frequency:** Daily (opt-in for self-hosted)

### Request

```http
POST https://api.obilabs.dev/api/instances/heartbeat
Content-Type: application/json
```

```typescript
interface HeartbeatRequest {
  instance_id: string;      // "Aegis_{nanoid(21)}"
  version: string;          // "1.2.3"
  license_key?: string;     // Optional for self-hosted

  metrics: {
    user_count_range: string;   // "1-10", "11-50", "51-100", "101-500", "500+"
    modules_enabled: string[];  // ["signatures", "google-sync"]
    uptime_hours: number;
    last_sync_status: "success" | "error" | "none";
  };
}
```

### Response

```typescript
interface HeartbeatResponse {
  success: boolean;
  server_time: string;      // ISO timestamp
  message?: string;
}
```

---

## License Validation

**Purpose:** Verify license and get feature entitlements
**Frequency:** On startup, then every 24 hours

### Request

```http
POST https://api.obilabs.dev/api/instances/validate
Content-Type: application/json
```

```typescript
interface ValidateRequest {
  instance_id: string;
  license_key: string;
  version: string;
}
```

### Response

```typescript
interface ValidateResponse {
  valid: boolean;
  plan: "community" | "starter" | "pro";

  features: {
    support_chat: boolean;
    priority_updates: boolean;
  };

  expires_at: string | null;  // null = subscription (no expiry)
  message?: string;
}
```

### Example Response (Community Mode)

```json
{
  "valid": false,
  "plan": "community",
  "features": {
    "support_chat": false,
    "priority_updates": false
  },
  "expires_at": null,
  "message": "Running in community mode. All features available."
}
```

---

## Error Handling

Clients should handle errors gracefully:

```typescript
try {
  await validateLicense();
} catch (err) {
  // Continue in offline/community mode
  useCachedState();
}
```

- **Network errors:** Continue working offline
- **4xx errors:** Log and use defaults
- **5xx errors:** Retry with backoff

---

## Changing These APIs

### Safe Changes (Backwards Compatible)

- Adding new optional fields to requests
- Adding new fields to responses
- Internal implementation changes

### Breaking Changes (Requires Coordination)

- Removing or renaming fields
- Changing field types
- Changing endpoint URLs

For breaking changes:
1. Add version negotiation
2. Update Aegis-web first (support both old and new)
3. Update clients with deprecation warnings
4. Remove old support after 6 months
