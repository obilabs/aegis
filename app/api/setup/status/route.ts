import { NextResponse } from 'next/server'
import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

export async function GET() {
  try {
    const userResult = await pool.query('SELECT COUNT(*) as count FROM "user"')
    const userCount = parseInt(userResult.rows[0].count, 10)

    // Check if an organization exists (wizard creates this)
    let orgCount = 0
    try {
      const orgResult = await pool.query('SELECT COUNT(*) as count FROM organizations')
      orgCount = parseInt(orgResult.rows[0].count, 10)
    } catch {
      // Table may not exist yet
    }

    return NextResponse.json({
      setupRequired: userCount === 0,
      wizardRequired: userCount > 0 && orgCount === 0,
      userCount,
    })
  } catch (error) {
    // If table doesn't exist yet, setup is required
    return NextResponse.json({
      setupRequired: true,
      wizardRequired: false,
      userCount: 0,
    })
  }
}
