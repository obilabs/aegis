import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'

/**
 * Setup templates offered by the first-run wizard (industry presets).
 *
 * The wizard has always requested this route; it did not exist, so every
 * setup logged a 404. Templates hold no instance data (names, descriptions and
 * feature keys only), so the list is readable without a session, like
 * /api/setup/status. An empty table yields an empty list.
 */
export async function GET() {
  try {
    const result = await pool.query(
      `SELECT id, name, description, industry, team_size, recommended_ui_mode,
              COALESCE(features_to_enable, '{}') AS features_to_enable
         FROM setup_templates
        ORDER BY display_order ASC, name ASC`,
    )
    return NextResponse.json({ templates: result.rows })
  } catch (error) {
    console.error('[setup] failed to list setup templates:', error)
    return NextResponse.json({ templates: [] })
  }
}
