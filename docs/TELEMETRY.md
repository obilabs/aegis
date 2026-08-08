# Telemetry and Data Collection

What data Aegis collects and how it's used.

## Our Approach

- **Opt-in for self-hosted:** Telemetry is OFF by default
- **Anonymous:** We don't identify individual users or organizations
- **Minimal:** We only collect what helps improve the product
- **Transparent:** This document explains everything we collect

## What We Collect

### Instance Heartbeat (Opt-in)

| Data | Example | Why |
|------|---------|-----|
| Instance ID | `Aegis_V1StGXR8...` | Unique identifier (random, not identifiable) |
| Version | `1.2.3` | Know which versions are in use |
| User count range | `"11-50"` | Understand scale (not exact counts) |
| Modules enabled | `["google-sync"]` | Know which features matter |
| Uptime | `720` hours | Health monitoring |
| Sync status | `"success"` | Error detection |

### What We NEVER Collect

- Organization name
- Domain name
- User names or emails
- Any Google Workspace data
- IP addresses (for self-hosted)
- Configuration details

## How to Control It

### Self-Hosted

Telemetry is OFF by default. To opt-in (in Aegis):

```env
Aegis_TELEMETRY_ENABLED=true
```

### Cloud Hosted (Coming Soon)

Basic telemetry will be required for cloud instances so we can:
- Monitor instance health
- Apply updates
- Provide support

## Why Opt-In Helps

When you opt in, you help us:
- **Prioritize features:** Know what people actually use
- **Find bugs:** Detect errors across versions
- **Plan capacity:** Understand typical deployments
- **Improve UX:** Focus on what matters most

## Data Retention

| Data | Retention |
|------|-----------|
| Heartbeats | 90 days |
| Aggregated stats | Indefinite (anonymized) |

## Your Rights

**Export your data:**
```
Email: privacy@obilabs.dev
Subject: Data Export Request - [Instance ID]
```

**Delete your data:**
```
Email: privacy@obilabs.dev
Subject: Data Deletion Request - [Instance ID]
```

## Questions?

- GitHub: https://github.com/obilabs/Aegis/discussions
- Email: privacy@obilabs.dev
