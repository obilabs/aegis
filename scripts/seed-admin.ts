/**
 * Aegis ITSM - Default Admin Seeder
 * 
 * Creates a default admin account for fresh installations.
 * Uses Better Auth's internal password hashing for compatibility.
 * 
 * ENVIRONMENT VARIABLES (set in .env):
 *   ADMIN_EMAIL    - Admin email (default: admin@aegis.local)
 *   ADMIN_PASSWORD - REQUIRED to opt into seeding. There is NO default. If it
 *                    is empty this script exits without seeding and the
 *                    operator creates the first admin at /portal/setup.
 *   ADMIN_NAME     - Admin display name (default: Aegis Administrator)
 * 
 * Usage:
 *   npx tsx scripts/seed-admin.ts
 *   # or
 *   pnpm seed:admin
 */

import { Pool } from 'pg'
import * as crypto from 'crypto'
import * as fs from 'fs'
import * as path from 'path'

// Load .env file if it exists (for local development)
function loadEnvFile() {
  const envPaths = [
    path.join(process.cwd(), '.env'),
    path.join(process.cwd(), '.env.local'),
    path.join(process.cwd(), '..', '..', '.env'), // monorepo root
  ]
  
  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf-8')
      for (const line of envContent.split('\n')) {
        const trimmed = line.trim()
        if (trimmed && !trimmed.startsWith('#')) {
          const [key, ...valueParts] = trimmed.split('=')
          const value = valueParts.join('=')
          if (key && value && !process.env[key]) {
            process.env[key] = value
          }
        }
      }
      console.log(`📁 Loaded environment from: ${envPath}`)
      break
    }
  }
}

loadEnvFile()

// ADMIN_PASSWORD is the routing knob between the two deploy modes, and it has
// NO DEFAULT. Empty means "I will create the first admin in the browser", not
// "seed me an insecure default".
//
// This file previously fell back to a hard-coded `ChangeMe123!`. The fallback
// was removed from `seed-admin.mjs` on 2026-06-14 as a security fix, and
// CLAUDE.md has asserted since then that "there is no ChangeMe123! fallback" —
// but the fix never reached THIS file, and `package.json` wires the documented
// `npm run seed:admin` script here. So the documented command still created an
// admin with a publicly known password while the docs promised it could not.
// Found by the 2026-08-16 CLAUDE.md drift audit.
//
// Behaviour now matches seed-admin.mjs exactly. Do not reintroduce a default.
const DEFAULT_EMAIL = process.env.ADMIN_EMAIL || 'admin@aegis.local'
const DEFAULT_PASSWORD = process.env.ADMIN_PASSWORD
const DEFAULT_NAME = process.env.ADMIN_NAME || 'Aegis Administrator'

if (!DEFAULT_PASSWORD) {
  console.log('')
  console.log('ADMIN_PASSWORD is not set — skipping admin seeding.')
  console.log('Create the first admin in the browser at /portal/setup.')
  console.log('')
  console.log('To seed headlessly instead (CI/CD), set ADMIN_PASSWORD and re-run.')
  console.log('')
  process.exit(0)
}

/**
 * Hash password using the same method as Better Auth
 * Better Auth uses scrypt with salt:hash format
 * 
 * IMPORTANT: Better Auth uses these exact parameters:
 * - N: 16384 (CPU/memory cost)
 * - r: 16 (block size) - NOT 8!
 * - p: 1 (parallelization)
 * - dkLen: 64 (derived key length)
 */
async function hashPassword(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // Generate a random salt (16 bytes = 32 hex chars)
    const salt = crypto.randomBytes(16).toString('hex')
    
    // Normalize password to NFKC (same as Better Auth)
    const normalizedPassword = password.normalize('NFKC')
    
    // Use scrypt with Better Auth's EXACT parameters
    // N=16384, r=16, p=1, keylen=64, maxmem calculated as 128 * N * r * 2
    const maxmem = 128 * 16384 * 16 * 2
    crypto.scrypt(normalizedPassword, salt, 64, { N: 16384, r: 16, p: 1, maxmem }, (err, derivedKey) => {
      if (err) {
        reject(err)
        return
      }
      // Format: salt:hash (same as Better Auth)
      resolve(`${salt}:${derivedKey.toString('hex')}`)
    })
  })
}

async function seedAdmin() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/aegis',
  })

  try {
    console.log('🛡️  Aegis Admin Seeder')
    console.log('━'.repeat(50))

    // Check if admin already exists
    const existingUser = await pool.query(
      'SELECT id, email FROM "user" WHERE email = $1',
      [DEFAULT_EMAIL]
    )

    if (existingUser.rows.length > 0) {
      console.log('⚠️  Default admin already exists!')
      console.log(`   Email: ${DEFAULT_EMAIL}`)
      
      // Update the password hash to ensure it works
      console.log('🔄 Updating password hash...')
      const passwordHash = await hashPassword(DEFAULT_PASSWORD)
      
      await pool.query(
        `UPDATE "account" SET password = $1, "updatedAt" = NOW() 
         WHERE "userId" = $2 AND "providerId" = 'credential'`,
        [passwordHash, existingUser.rows[0].id]
      )
      
      console.log('✅ Password updated!')
      console.log('')
      console.log('📧 Email:    ' + DEFAULT_EMAIL)
      console.log('🔑 Password: ' + DEFAULT_PASSWORD)
      return
    }

    // Check if any users exist
    const userCount = await pool.query('SELECT COUNT(*) as count FROM "user"')
    const count = parseInt(userCount.rows[0].count, 10)

    if (count > 0) {
      console.log(`ℹ️  Found ${count} existing user(s).`)
      console.log('   Creating default admin alongside existing users.')
    }

    // Generate password hash using Better Auth's format
    console.log('🔐 Generating password hash...')
    const passwordHash = await hashPassword(DEFAULT_PASSWORD)

    // Generate unique IDs
    const timestamp = Date.now()
    const userId = `aegis-admin-${timestamp}`
    const accountId = `aegis-account-${timestamp}`

    // Create user
    console.log('👤 Creating admin user...')
    await pool.query(
      `INSERT INTO "user" (id, email, name, role, "emailVerified", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
      [userId, DEFAULT_EMAIL, DEFAULT_NAME, 'admin', true]
    )

    // Create account (for email/password auth)
    console.log('🔑 Creating auth account...')
    await pool.query(
      `INSERT INTO "account" (id, "userId", "accountId", "providerId", password, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
      [accountId, userId, DEFAULT_EMAIL, 'credential', passwordHash]
    )

    console.log('')
    console.log('✅ Default admin created successfully!')
    console.log('━'.repeat(50))
    console.log('')
    console.log('📧 Email:    ' + DEFAULT_EMAIL)
    console.log('🔑 Password: ' + DEFAULT_PASSWORD)
    console.log('')
    console.log('⚠️  IMPORTANT: Change this password immediately after login!')
    console.log('')

  } catch (error) {
    console.error('❌ Error creating admin:', error)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

seedAdmin()
