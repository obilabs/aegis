/**
 * Seed the feature_registry table from the FEATURES constant.
 *
 * The registry is the FK target for organization_feature_flags. If it's
 * empty, every /api/features/enable POST silently fails on the FK
 * constraint even though the API returns success — a latent bug that
 * makes every feature flag look enabled while actually being disabled.
 *
 * This function is idempotent via ON CONFLICT (feature_key) DO UPDATE:
 * safe to re-run on any install to bring the registry up to date after
 * a features.ts change.
 *
 * Runs at:
 *   1. First-boot setup wizard completion (via /api/setup/complete)
 *   2. On-demand via POST /api/admin/features/reseed
 */

import { pool } from '@/lib/db'
import { FEATURES } from '@/lib/features'

export async function seedFeatureRegistry(): Promise<{ inserted: number; updated: number }> {
  const entries = Object.values(FEATURES)
  let inserted = 0
  let updated = 0

  for (const f of entries) {
    // stableVersion is optional on some feature defs — use fallback so
    // NOT NULL constraints don't fail.
    const stableVersion = (f as { stableVersion?: string }).stableVersion ?? '1.0.0'
    const result = await pool.query(
      `INSERT INTO feature_registry (
         feature_key, feature_name, description, category, status,
         introduced_version, stable_version, default_enabled, can_disable,
         icon, badge_text, badge_color
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (feature_key) DO UPDATE SET
         feature_name = EXCLUDED.feature_name,
         description = EXCLUDED.description,
         category = EXCLUDED.category,
         status = EXCLUDED.status,
         stable_version = EXCLUDED.stable_version,
         default_enabled = EXCLUDED.default_enabled,
         can_disable = EXCLUDED.can_disable,
         icon = EXCLUDED.icon,
         badge_text = EXCLUDED.badge_text,
         badge_color = EXCLUDED.badge_color
       RETURNING xmax = 0 AS inserted`,
      [
        f.key,
        f.name,
        f.description,
        f.category,
        f.status,
        '1.0.0', // introduced_version — not tracked in FEATURES const yet
        stableVersion,
        f.defaultEnabled,
        f.canDisable,
        f.icon,
        f.badgeText || null,
        f.badgeColor || null,
      ],
    )
    if (result.rows[0]?.inserted) {
      inserted++
    } else {
      updated++
    }
  }

  return { inserted, updated }
}
