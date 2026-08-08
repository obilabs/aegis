# Feature Flags System

Aegis uses a comprehensive feature flag system to manage feature availability, beta testing, and progressive rollouts.

## Feature States

| State | Description | Can Enable? | Badge |
|-------|-------------|-------------|-------|
| **stable** | Production ready, fully tested | ✅ Yes | None |
| **beta** | Working but may have bugs | ✅ Yes (with acknowledgment) | 🟡 BETA |
| **alpha** | Experimental, use with caution | ✅ Yes (with acknowledgment) | 🔴 ALPHA |
| **coming_soon** | Not yet available | ❌ No | ⚪ COMING SOON |
| **deprecated** | Being phased out | ❌ No | ⚪ DEPRECATED |

## Feature Categories

| Category | Description | Default |
|----------|-------------|---------|
| **core** | Essential features (tickets, contacts, auth) | Always enabled |
| **standard** | Common features (KB, assets, credentials) | Enabled by default |
| **advanced** | Power user features (SLA, workflows, vendors) | Disabled by default |
| **enterprise** | Large org features (workspaces, teams, RBAC) | Disabled by default |

## Using Feature Flags

### 1. In React Components

```tsx
import { FeatureGate, FeatureBadge, FeatureNotice } from '@/components/features/FeatureGate';

// Hide content if feature is disabled
<FeatureGate feature="sla_management">
  <SLASettings />
</FeatureGate>

// Show "coming soon" placeholder
<FeatureGate feature="webhooks" showComingSoon>
  <WebhookSettings />
</FeatureGate>

// Show badge next to feature name
<h1>SLA Management <FeatureBadge feature="sla_management" /></h1>

// Show notice banner for beta/alpha features
<FeatureNotice feature="sla_management" />
```

### 2. Using the Hook

```tsx
import { useFeature, useFeatures } from '@/lib/hooks/useFeatures';

function MyComponent() {
  // Check single feature
  const { isEnabled, feature, isLoading } = useFeature('sla_management');
  
  // Access all features
  const { isEnabled, enableFeature, disableFeature } = useFeatures();
  
  if (!isEnabled('sla_management')) {
    return <UpgradePrompt />;
  }
  
  return <SLADashboard />;
}
```

### 3. In Navigation

```tsx
import { NavItemWithFeature } from '@/components/features/FeatureGate';

<NavItemWithFeature feature="vendors" showBadge>
  <Link href="/portal/vendors">Vendors</Link>
</NavItemWithFeature>
```

### 4. Server-Side (API Routes)

```ts
import { FEATURES, isFeatureAvailable } from '@/lib/features';

export async function GET(request: Request) {
  // Check if feature exists and is available
  if (!isFeatureAvailable('sla_management')) {
    return Response.json({ error: 'Feature not available' }, { status: 404 });
  }
  
  // Check if feature is enabled for organization (requires DB query)
  const result = await db.query(
    `SELECT is_feature_enabled_v2($1, $2) as enabled`,
    [organizationId, 'sla_management']
  );
  
  if (!result.rows[0]?.enabled) {
    return Response.json({ error: 'Feature not enabled' }, { status: 403 });
  }
  
  // ... rest of handler
}
```

## Database Schema

### feature_registry
Defines all available features with their metadata:
- `feature_key` - Unique identifier
- `status` - stable, beta, alpha, coming_soon, deprecated
- `introduced_version` - When feature was added
- `stable_version` - When feature becomes stable
- `default_enabled` - Whether enabled by default
- `can_disable` - Whether feature can be disabled

### organization_feature_flags
Per-organization overrides:
- `enabled` - Whether feature is enabled
- `beta_acknowledged` - Whether user acknowledged beta status
- `enabled_by` - Who enabled the feature

## Adding New Features

1. Add to `apps/aegis/lib/features.ts`:

```ts
export const FEATURES: Record<string, Feature> = {
  // ...existing features
  
  my_new_feature: {
    key: 'my_new_feature',
    name: 'My New Feature',
    description: 'Description of what it does',
    category: 'advanced',
    status: 'beta',
    icon: 'Sparkles',
    badgeText: 'BETA',
    badgeColor: 'yellow',
    defaultEnabled: false,
    canDisable: true,
    stableVersion: '1.3.0',
  },
};
```

2. Add to database migration:

```sql
INSERT INTO feature_registry (
  feature_key, feature_name, description, category, status,
  introduced_version, stable_version, default_enabled, can_disable,
  icon, badge_text, badge_color
) VALUES (
  'my_new_feature', 'My New Feature', 'Description', 'advanced', 'beta',
  '1.0.0', '1.3.0', false, true,
  'Sparkles', 'BETA', 'yellow'
);
```

3. Wrap your feature UI:

```tsx
<FeatureGate feature="my_new_feature">
  <MyNewFeatureComponent />
</FeatureGate>
```

## Promoting Features

When a feature is ready to move from beta to stable:

1. Update `apps/aegis/lib/features.ts`:
   - Change `status` to `'stable'`
   - Remove `badgeText` and `badgeColor`
   - Set `defaultEnabled: true` if appropriate

2. Update database:
```sql
UPDATE feature_registry 
SET status = 'stable', badge_text = NULL, badge_color = NULL
WHERE feature_key = 'my_feature';
```

## Current Feature Status

### Stable (v1.0.0)
- ✅ Tickets
- ✅ Contacts
- ✅ Authentication
- ✅ Knowledge Base
- ✅ Assets
- ✅ Credentials
- ✅ Companies
- ✅ Dashboard
- ✅ Audit Logging
- ✅ API Access

### Beta
- 🟡 SLA Management (stable in v1.2.0)
- 🟡 Custom Statuses (stable in v1.2.0)
- 🟡 Workflows (stable in v1.3.0)
- 🟡 Vendors (stable in v1.2.0)
- 🟡 Service Catalog (stable in v1.3.0)
- 🟡 Onboarding/Offboarding (stable in v1.3.0)
- 🟡 Organization Hierarchy (stable in v1.3.0)
- 🟡 Policies (stable in v1.3.0)
- 🟡 Email Integration (stable in v1.2.0)
- 🟡 AI Chat (stable in v1.3.0)
- 🟡 AI Suggestions (stable in v1.3.0)
- 🟡 AI Editor (stable in v1.2.0)
- 🟡 Provider Access (stable in v1.5.0)
- 🟡 Credential Sharing (stable in v1.5.0)
- 🟡 Advanced RBAC (stable in v1.5.0)

### Alpha
- 🔴 Workspaces (stable in v2.0.0)
- 🔴 Teams & Routing (stable in v2.0.0)
- 🔴 Approval Workflows (stable in v2.0.0)
- 🔴 AI Triage (stable in v2.0.0)

### Coming Soon
- ⚪ Webhooks (v1.1.0)
- ⚪ Single Sign-On (v1.2.0)
- ⚪ SSL Monitoring (v1.2.0)
- ⚪ DNS Monitoring (v1.2.0)
- ⚪ Uptime Monitoring (v1.3.0)
