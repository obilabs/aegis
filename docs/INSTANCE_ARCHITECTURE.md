# Instance Communication Architecture

How Aegis instances communicate with Aegis-web.

## Overview

```
┌─────────────────────────────────────────┐
│           api.obilabs.dev            │
│              (Aegis-web)               │
│                                         │
│  ┌──────────────────────────────────┐  │
│  │        API Endpoints             │  │
│  │                                  │  │
│  │  POST /api/instances/heartbeat   │  │
│  │  POST /api/instances/validate    │  │
│  │  GET  /api/insights              │  │
│  └──────────────────────────────────┘  │
└─────────────────────────────────────────┘
                    ▲
                    │
        ┌───────────┴───────────┐
        │                       │
┌───────────────┐       ┌───────────────┐
│ Self-Hosted   │       │ Cloud Hosted  │
│ Instance      │       │ Instance      │
│               │       │ (coming soon) │
│ Opt-in only   │       │ Required      │
│ Anonymous     │       │ Licensed      │
└───────────────┘       └───────────────┘
```

## Instance Heartbeat

Instances can optionally send anonymous health data.

### Request

```http
POST /api/instances/heartbeat
Content-Type: application/json
```

```json
{
  "instance_id": "Aegis_V1StGXR8_Z5jdHi6B-myT",
  "version": "1.2.3",
  "license_key": null,
  "metrics": {
    "user_count_range": "11-50",
    "modules_enabled": ["google-sync"],
    "uptime_hours": 720,
    "last_sync_status": "success"
  }
}
```

### Response

```json
{
  "success": true,
  "server_time": "2024-01-15T10:30:00Z"
}
```

## License Validation

Validates license keys (for future paid features).

### Request

```http
POST /api/instances/validate
Content-Type: application/json
```

```json
{
  "instance_id": "Aegis_xxx",
  "license_key": "lic_pro_xxx",
  "version": "1.2.3"
}
```

### Response

```json
{
  "valid": true,
  "plan": "community",
  "features": {
    "support_chat": false,
    "priority_updates": false
  },
  "message": "Running in community mode."
}
```

## Data Collection

### What We Collect (Anonymous)

- Instance ID (random identifier)
- Software version
- User count range (bucketed: "1-10", "11-50", etc.)
- Enabled modules
- Uptime
- Sync status

### What We NEVER Collect

- Organization name
- Domain name
- User names or emails
- Any actual data
- IP addresses (for self-hosted)

## Self-Hosted vs Cloud

| Aspect | Self-Hosted | Cloud (Coming) |
|--------|-------------|----------------|
| Telemetry | Opt-in | Required |
| License Key | None | Required |
| Support Chat | No | Yes |
| Updates | Manual | Automatic |
| Data Location | Your server | Our infrastructure |
