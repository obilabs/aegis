# 🛡️ Aegis Vision & Strategy

> **Mission:** Make Aegis the de-facto standard for IT management worldwide - the "WiFi/Bluetooth" of ITSM.

---

## The Problem We're Solving

### Vendor Lock-In is Killing IT Teams

| Problem | Impact |
|---------|--------|
| **Data hostage** | Can't leave ServiceNow/ITGlue without losing years of documentation |
| **Pricing games** | Vendors raise prices after you're locked in |
| **MSP trust issues** | Clients can't see what their MSP is doing with their data |
| **Fragmentation** | Passwords in one tool, assets in another, tickets in a third |
| **Complexity** | Enterprise tools require consultants to configure |

### The Market Gap

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   ENTERPRISE                          │  SMALL BUSINESS                     │
│   ServiceNow, BMC                     │  Spreadsheets, Email                │
│   $100+/user/month                    │  Free but chaotic                   │
│   Requires consultants                │  No structure                       │
│                                       │                                     │
│                    ┌─────────────────────────────┐                          │
│                    │                             │                          │
│                    │      THE GAP                │                          │
│                    │                             │                          │
│                    │   Aegis fills this space:  │                          │
│                    │   • Enterprise features    │                          │
│                    │   • Simple to use          │                          │
│                    │   • Free forever           │                          │
│                    │   • You own your data      │                          │
│                    │                             │                          │
│                    └─────────────────────────────┘                          │
│                                                                             │
│   MID-MARKET                                                                │
│   Freshservice, Jira SM                                                     │
│   $50-80/user/month                                                         │
│   Still lock-in                                                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## The Vision: WiFi/Bluetooth of IT Management

### What Made WiFi Successful?

| Factor | WiFi | Aegis |
|--------|------|-------|
| **Simple core** | Connect devices wirelessly | Manage tickets, assets, knowledge |
| **Works immediately** | Pair and go | Install and use |
| **Open standard** | IEEE 802.11 | Aegis API Specification |
| **Reference implementation** | Chips that "just work" | aegis |
| **Extensible** | Profiles, protocols | Plugins, integrations |
| **Ubiquitous** | Every device has it | Every IT team uses it |

### The Goal

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   In 5 years, when someone says "IT management," they mean Aegis.          │
│                                                                             │
│   • "We use Aegis" = "We have WiFi"                                        │
│   • "Aegis-compatible" = "Bluetooth-enabled"                               │
│   • "Export to Aegis format" = "Save as PDF"                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Architecture: aegis IS the Core

**aegis is not just an app - it's the reference implementation that defines the standard.**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│                           AEGIS ECOSYSTEM                                   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                     │   │
│  │                      aegis (THE CORE)                        │   │
│  │                      ═══════════════════════                        │   │
│  │                                                                     │   │
│  │   The "WiFi Chip" - Must be perfect                                │   │
│  │                                                                     │   │
│  │   • Single-tenant, self-hosted ITSM                                │   │
│  │   • Defines the Aegis Data Model                                   │   │
│  │   • Defines the Aegis API Specification                            │   │
│  │   • Open source (MIT/Apache)                                       │   │
│  │   • Zero vendor lock-in                                            │   │
│  │                                                                     │   │
│  │   Core Entities:                                                   │   │
│  │   ├── Organizations (the tenant)                                   │   │
│  │   ├── Contacts (people: employees, customers, vendors)             │   │
│  │   ├── Assets (things: hardware, software, licenses)                │   │
│  │   ├── Tickets (requests: incidents, service requests)              │   │
│  │   ├── Articles (knowledge: docs, how-tos, runbooks)                │   │
│  │   └── Credentials (secrets: passwords, API keys)                   │   │
│  │                                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    │ Aegis API                              │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                     │   │
│  │                      SATELLITE APPLICATIONS                         │   │
│  │                      ══════════════════════                         │   │
│  │                                                                     │   │
│  │   aegis-mtp ─────► Multi-Tenant Portal for MSPs                    │   │
│  │                    Connects to multiple aegis instances      │   │
│  │                    MSP manages clients, clients own their data      │   │
│  │                                                                     │   │
│  │   aegis-rmm ─────► Remote Monitoring & Management Agent            │   │
│  │                    Runs on endpoints, reports to aegis       │   │
│  │                    Auto-discovers assets, monitors health           │   │
│  │                                                                     │   │
│  │   aegis-mdm ─────► Mobile Device Management                        │   │
│  │                    Manages phones/tablets, reports to aegis  │   │
│  │                                                                     │   │
│  │   aegis-web ─────► Marketing & Licensing Portal                    │   │
│  │                    Instance registration, telemetry                 │   │
│  │                                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    │ Plugin API                             │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                     │   │
│  │                      COMMUNITY ECOSYSTEM                            │   │
│  │                      ═══════════════════                            │   │
│  │                                                                     │   │
│  │   Integrations:    Slack, Teams, Jira, GitHub, PagerDuty           │   │
│  │   Importers:       From ServiceNow, Freshservice, ITGlue           │   │
│  │   Exporters:       To any format (CSV, JSON, PDF)                  │   │
│  │   Themes:          Custom UI themes                                │   │
│  │   Reports:         Custom dashboards and analytics                 │   │
│  │                                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Core Principles

### 1. Client Data Sovereignty

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   THE CLIENT OWNS THEIR DATA. ALWAYS.                                       │
│                                                                             │
│   • Data lives in client's aegis instance                           │
│   • MSPs BORROW access, they don't OWN data                                │
│   • Fire your MSP? Revoke access instantly                                 │
│   • Export everything, anytime, in standard formats                        │
│   • No "please contact support to get your data"                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2. Simple Core, Extensible Edge

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   CORE (aegis v1.0)          │  EXTENSIONS (plugins)                │
│   ════════════════════════          │  ════════════════════                │
│                                     │                                      │
│   • Tickets                         │  • SLA Management                    │
│   • Contacts                        │  • Workflow Automation               │
│   • Assets                          │  • SCIM Provisioning                 │
│   • Knowledge Base                  │  • AI Triage                         │
│   • Credentials                     │  • Advanced RBAC                     │
│   • Audit Log                       │  • Onboarding/Offboarding            │
│   • Basic Auth                      │  • Vendor Management                 │
│   • REST API                        │  • Service Catalog                   │
│                                     │                                      │
│   MUST be perfect.                  │  Enable as needed.                   │
│   Works for everyone.               │  Power user features.                │
│                                     │                                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3. Open Standard

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   THE AEGIS SPECIFICATION                                                   │
│                                                                             │
│   1. Data Model    - How entities relate to each other                     │
│   2. API Spec      - REST endpoints, request/response formats              │
│   3. Export Format - Standard JSON/CSV structure for portability           │
│   4. Plugin API    - How to extend aegis                            │
│                                                                             │
│   Anyone can:                                                               │
│   • Build an Aegis-compatible tool                                         │
│   • Import/export Aegis format                                             │
│   • Create plugins for aegis                                        │
│   • Fork and modify aegis                                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4. Progressive Disclosure

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   SAME FEATURES, DIFFERENT COMPLEXITY                                       │
│                                                                             │
│   Simple Mode (Kelly from Accounting)                                       │
│   • Clean, minimal interface                                               │
│   • "Create Ticket" not "Submit Service Request"                           │
│   • Hides advanced options                                                 │
│                                                                             │
│   Standard Mode (IT Technician)                                            │
│   • Full feature access                                                    │
│   • Balanced complexity                                                    │
│                                                                             │
│   Advanced Mode (IT Director / MSP)                                        │
│   • All options visible                                                    │
│   • Bulk operations                                                        │
│   • API access, automation                                                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Release Strategy

### v1.0 - "The Foundation" (Current Focus)

**Goal:** A working ITSM that any IT team can use TODAY.

| Feature | Status | Priority |
|---------|--------|----------|
| Tickets (CRUD, list, detail) | 🟡 Beta | P0 |
| Contacts (CRUD, types) | 🟡 Beta | P0 |
| Assets (CRUD, types, linking) | 🟡 Beta | P0 |
| Knowledge Base (CRUD, public portal) | 🟡 Beta | P0 |
| Credentials (CRUD, secure reveal) | 🟡 Beta | P0 |
| Audit Log (view actions) | 🟡 Beta | P0 |
| Auth (email/password, Google Workspace) | ✅ Stable | P0 |
| Settings (org, users) | 🟡 Beta | P0 |
| REST API v1 | 🟡 Beta | P0 |
| Documentation | 🔴 Missing | P0 |

**Ship when:** All P0 features work end-to-end without bugs.

### v1.1 - "Polish"

- Bug fixes from v1.0 feedback
- Performance improvements
- Mobile-responsive UI
- Email notifications

### v1.2 - "Power Users"

- SLA Management
- Custom Ticket Statuses
- Email-to-Ticket
- Webhooks

### v1.3 - "Automation"

- Workflow Engine
- AI Suggestions
- Scheduled Reports

### v2.0 - "Enterprise"

- SCIM Provisioning
- SAML/OIDC SSO
- Advanced RBAC
- Workspaces (multi-department)

---

## Success Metrics

### Adoption

| Metric | Target (Year 1) | Target (Year 3) |
|--------|-----------------|-----------------|
| GitHub Stars | 1,000 | 10,000 |
| Active Instances | 100 | 5,000 |
| Monthly Active Users | 500 | 50,000 |
| Community Contributors | 10 | 100 |

### Quality

| Metric | Target |
|--------|--------|
| Uptime (self-hosted) | 99.9% |
| API Response Time | < 200ms |
| Bug Resolution Time | < 7 days |
| Documentation Coverage | 100% of API |

### Community

| Metric | Target |
|--------|--------|
| Plugins Available | 20+ |
| Integrations | 10+ |
| Translations | 5+ languages |

---

## Competitive Positioning

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   "Aegis is the open-source ITSM that gives you data sovereignty.          │
│    Unlike ServiceNow or ITGlue, you own your data forever.                 │
│    Enterprise features. Zero vendor lock-in. Free forever."                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

vs. ServiceNow:     "Enterprise power without enterprise pricing or lock-in"
vs. Freshservice:   "Same features, you own the data, free forever"
vs. ITGlue:         "Documentation + ticketing + assets in one place"
vs. osTicket/GLPI:  "Modern UI, better UX, active development"
```

---

## The Aegis Promise

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   🛡️ YOUR DATA IS YOURS                                                    │
│      Export everything, anytime. No lock-in. Ever.                         │
│                                                                             │
│   🔓 OPEN SOURCE FOREVER                                                   │
│      AGPL-3.0 licensed. View it, fork it, contribute to it.               │
│                                                                             │
│   🚀 ENTERPRISE READY                                                      │
│      Features that scale from 5 users to 5,000.                            │
│                                                                             │
│   💰 FREE FOREVER                                                          │
│      No "upgrade to unlock." No per-user pricing games.                    │
│                                                                             │
│   🤝 COMMUNITY DRIVEN                                                      │
│      Built by IT people, for IT people.                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Next Steps

1. **Audit v1.0 features** - What works? What's broken?
2. **Fix critical bugs** - Make core features solid
3. **Write documentation** - API spec, user guide, admin guide
4. **Ship v1.0** - Get real users
5. **Iterate** - Build what users actually need

---

*Last Updated: February 2026*
*Document Owner: Aegis Core Team*
