# CRUD Permission Matrix

This document defines what operations Clients (data owners) and MSPs (providers) can perform on each entity type.

## Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Full access |
| ⚠️ | Limited/Conditional access |
| ❌ | No access |
| 🔒 | Requires approval |
| 📝 | Action is logged/audited |
| 🔔 | Client is notified |
| 🚨 | Triggers alert |

---

## Core Entities

### Tickets

| Operation | Client | MSP | Scope Required | Notes |
|-----------|--------|-----|----------------|-------|
| **C**reate | ✅ | ✅ 📝 | `tickets:write` | MSP can create on behalf of client |
| **R**ead | ✅ | ✅ 📝 | `tickets:read` | All tickets or filtered by assignment |
| **U**pdate | ✅ | ✅ 📝 | `tickets:write` | Status, priority, assignment, notes |
| **D**elete (soft) | ✅ | ✅ 📝 | `tickets:soft_delete` | Marks as deleted, client can restore |
| **D**elete (hard) | ✅ | ❌ | N/A | Only client can permanently delete |

### Assets

| Operation | Client | MSP | Scope Required | Notes |
|-----------|--------|-----|----------------|-------|
| **C**reate | ✅ | ✅ 📝 | `assets:write` | MSP can add discovered assets |
| **R**ead | ✅ | ✅ 📝 | `assets:read` | Inventory, specs, assignments |
| **U**pdate | ✅ | ✅ 📝 | `assets:write` | Specs, status, assignment, notes |
| **D**elete (soft) | ✅ | ✅ 📝 | `assets:soft_delete` | Marks as deleted |
| **D**elete (hard) | ✅ | ❌ | N/A | Only client can permanently delete |

### Contacts

| Operation | Client | MSP | Scope Required | Notes |
|-----------|--------|-----|----------------|-------|
| **C**reate | ✅ | ✅ 📝 | `contacts:write` | MSP can add vendor contacts, etc. |
| **R**ead | ✅ | ✅ 📝 | `contacts:read` | Contact info, department, role |
| **U**pdate | ✅ | ✅ 📝 | `contacts:write` | Contact details, department |
| **D**elete (soft) | ✅ | ✅ 📝 | `contacts:soft_delete` | Marks as deleted |
| **D**elete (hard) | ✅ | ❌ | N/A | Only client can permanently delete |

### Credentials

| Operation | Client | MSP | Scope Required | Notes |
|-----------|--------|-----|----------------|-------|
| **C**reate | ✅ | ✅ 📝 🔔 | `credentials:create` | MSP can save creds for client |
| **R**ead (metadata) | ✅ | ✅ 📝 | `credentials:read` | Name, URL, username, notes |
| **R**ead (password) | ✅ | 🔒 📝 | `credentials:reveal` | Requires access grant |
| **U**pdate | ✅ | ✅ 📝 🔔 | `credentials:update` | Password reset, URL change |
| **D**elete (soft) | ✅ | ✅ 📝 | `credentials:soft_delete` | Marks as deleted |
| **D**elete (hard) | ✅ | ❌ | N/A | Only client can permanently delete |

### Knowledge Base Articles

| Operation | Client | MSP | Scope Required | Notes |
|-----------|--------|-----|----------------|-------|
| **C**reate | ✅ | ✅ 📝 | `kb:write` | MSP can contribute documentation |
| **R**ead | ✅ | ✅ 📝 | `kb:read` | Based on article visibility settings |
| **U**pdate | ✅ | ✅ 📝 | `kb:write` | Content, metadata, visibility |
| **D**elete (soft) | ✅ | ✅ 📝 | `kb:soft_delete` | Marks as deleted |
| **D**elete (hard) | ✅ | ❌ | N/A | Only client can permanently delete |

### Documents

| Operation | Client | MSP | Scope Required | Notes |
|-----------|--------|-----|----------------|-------|
| **C**reate | ✅ | ✅ 📝 | `documents:write` | MSP can upload documentation |
| **R**ead | ✅ | ✅ 📝 | `documents:read` | Download, view metadata |
| **U**pdate | ✅ | ✅ 📝 | `documents:write` | Replace file, update metadata |
| **D**elete (soft) | ✅ | ✅ 📝 | `documents:soft_delete` | Marks as deleted |
| **D**elete (hard) | ✅ | ❌ | N/A | Only client can permanently delete |

---

## Administrative Entities

### Users

| Operation | Client | MSP | Notes |
|-----------|--------|-----|-------|
| **C**reate | ✅ | ❌ | Only client manages internal users |
| **R**ead | ✅ | ⚠️ | MSP sees limited info (name, role) |
| **U**pdate | ✅ | ❌ | Only client manages users |
| **D**elete | ✅ | ❌ | Only client manages users |

### Organization Settings

| Operation | Client | MSP | Notes |
|-----------|--------|-----|-------|
| **C**reate | ✅ | ❌ | Client-only |
| **R**ead | ✅ | ❌ | Client-only |
| **U**pdate | ✅ | ❌ | Client-only |
| **D**elete | ✅ | ❌ | Client-only |

### API Keys / Provider Access

| Operation | Client | MSP | Notes |
|-----------|--------|-----|-------|
| **C**reate | ✅ | ❌ | Client creates keys for MSPs |
| **R**ead | ✅ | ⚠️ | MSP can view own key info only |
| **U**pdate | ✅ | ❌ | Client manages scopes, expiry |
| **D**elete | ✅ | ❌ | Client revokes access |

### Audit Logs

| Operation | Client | MSP | Notes |
|-----------|--------|-----|-------|
| **C**reate | Auto | Auto | System-generated, immutable |
| **R**ead | ✅ All | ⚠️ Own | MSP sees only their own actions |
| **U**pdate | ❌ | ❌ | Immutable |
| **D**elete | ❌ | ❌ | Immutable |

### Contracts

| Operation | Client | MSP | Notes |
|-----------|--------|-----|-------|
| **C**reate | ✅ | ❌ | Client defines access terms |
| **R**ead | ✅ | ✅ | MSP must read to acknowledge |
| **U**pdate | ✅ | ❌ | Client updates terms |
| **D**elete | ✅ | ❌ | Client manages |

---

## Credential Access Modes

Credentials have special access controls for revealing sensitive values:

| Mode | Password Visible | Approval Required | Time Limit | Check-in | Alert |
|------|------------------|-------------------|------------|----------|-------|
| **Never** | ❌ | N/A | N/A | N/A | N/A |
| **On-Demand** | 🔒 | ✅ Per-request | 8 hours | ❌ | ❌ |
| **Time-Boxed** | ✅ | ✅ Initial | Configurable | ✅ Daily | ❌ |
| **Break-Glass** | ✅ | ❌ | Session | ❌ | 🚨 Immediate |

### Credential Operations by Access Mode

| Operation | Never | On-Demand | Time-Boxed | Break-Glass |
|-----------|-------|-----------|------------|-------------|
| View name/URL | ✅ | ✅ | ✅ | ✅ |
| View username | ✅ | ✅ | ✅ | ✅ |
| Reveal password | ❌ | 🔒 After approval | ✅ If checked in | ✅ 🚨 |
| Copy password | ❌ | ⚠️ 3 reveals max | ⚠️ Limited | ✅ 🚨 |
| Create new | ✅ 🔔 | ✅ 🔔 | ✅ 🔔 | ✅ 🔔 |
| Update existing | ❌ | ❌ | ❌ | ❌ |

---

## Soft Delete Behavior

When an MSP soft-deletes an item:

1. **Item is marked** with `is_deleted = true`
2. **Metadata recorded**: who deleted, when, why
3. **Item appears grayed** in client's view
4. **Client can**:
   - **Restore**: Undo the deletion
   - **Hard Delete**: Permanently remove

### Soft Delete Fields

```
is_deleted: true
deleted_at: "2026-02-05T20:00:00Z"
deleted_by_provider_id: "uuid"
deleted_by_name: "John Smith (Acme MSP)"
delete_reason: "Duplicate entry - see TKT-456"
```

### Restoration Fields

```
is_deleted: false
restored_at: "2026-02-05T21:00:00Z"
restored_by_user_id: "uuid"
```

---

## API Scope Reference

| Scope | C | R | U | D (Soft) | Risk Level |
|-------|---|---|---|----------|------------|
| `tickets:read` | | ✅ | | | Low |
| `tickets:write` | ✅ | | ✅ | | Medium |
| `tickets:soft_delete` | | | | ✅ | Medium |
| `assets:read` | | ✅ | | | Low |
| `assets:write` | ✅ | | ✅ | | Medium |
| `assets:soft_delete` | | | | ✅ | Medium |
| `contacts:read` | | ✅ | | | Medium |
| `contacts:write` | ✅ | | ✅ | | Medium |
| `contacts:soft_delete` | | | | ✅ | Medium |
| `credentials:read` | | ✅* | | | Medium |
| `credentials:reveal` | | ✅** | | | Critical |
| `credentials:create` | ✅ | | | | High |
| `credentials:update` | | | ✅ | | High |
| `credentials:soft_delete` | | | | ✅ | High |
| `kb:read` | | ✅ | | | Low |
| `kb:write` | ✅ | | ✅ | | Medium |
| `kb:soft_delete` | | | | ✅ | Medium |
| `documents:read` | | ✅ | | | Low |
| `documents:write` | ✅ | | ✅ | | Medium |
| `documents:soft_delete` | | | | ✅ | Medium |
| `users:read` | | ⚠️ | | | Medium |
| `admin:audit` | | ⚠️ | | | High |

*Metadata only (name, URL, username)
**Actual password value (requires access grant)

---

## Data Ownership Summary

| Data | Owner | MSP Role | Sync to MTP |
|------|-------|----------|-------------|
| Tickets | Client | Contributor | ✅ Cached |
| Assets | Client | Contributor | ✅ Cached |
| Contacts | Client | Contributor | ✅ Cached |
| Credentials | Client | Contributor | ❌ Never* |
| KB Articles | Client | Contributor | ✅ Cached |
| Documents | Client | Contributor | ⚠️ Metadata only |
| Users | Client | Viewer (limited) | ❌ Never |
| Settings | Client | None | ❌ Never |
| Audit Logs | Client | Viewer (own) | ❌ Never |

*Credential values are NEVER synced. MSP fetches on-demand with approval.

---

## Example: MSP Workflow

```
1. MSP receives ticket from client
   → tickets:read ✅

2. MSP updates ticket status
   → tickets:write ✅ 📝

3. MSP needs server password
   → credentials:read ✅ (sees name, URL)
   → credentials:reveal 🔒 (requests access)
   → Client approves
   → credentials:reveal ✅ 📝 (views password)

4. MSP resets password, saves new one
   → credentials:create ✅ 📝 🔔
   → Client notified of new credential

5. MSP marks old contact as deleted
   → contacts:soft_delete ✅ 📝
   → Client sees grayed item, can restore

6. MSP resolves ticket
   → tickets:write ✅ 📝
```

---

## Security Principles

1. **Client owns all data** - MSP is a contributor, not owner
2. **Soft delete only** - MSP cannot permanently destroy data
3. **Credentials protected** - Password reveal requires approval
4. **Full audit trail** - Every MSP action is logged
5. **Instant revocation** - Client can cut off MSP access anytime
6. **Contract required** - MSP must acknowledge terms before access
