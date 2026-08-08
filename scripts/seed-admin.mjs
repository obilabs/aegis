#!/usr/bin/env node
/**
 * Aegis - Admin Seed Script
 *
 * Creates the first admin user on fresh installs from env vars:
 *   ADMIN_EMAIL    (default: admin@aegis.local — only used IF ADMIN_PASSWORD is set)
 *   ADMIN_PASSWORD (REQUIRED to opt into seeding; if empty, the operator
 *                   creates the admin in-browser at /portal/setup instead)
 *   ADMIN_NAME     (default: Aegis Administrator)
 *   DATABASE_URL   (required)
 *
 * Two deploy modes:
 *
 *   1. Interactive (RECOMMENDED for individual operators): leave
 *      ADMIN_PASSWORD empty. This script exits early without seeding.
 *      The operator hits /portal/setup in a browser, picks their email
 *      + password, then walks through the wizard (including the
 *      telemetry consent step from PRINCIPLES.md #2).
 *
 *   2. Headless (for CI/CD / scripted deployments): set ADMIN_PASSWORD.
 *      The script seeds the admin so signing in works immediately.
 *      NOTE: the operator who sets ADMIN_PASSWORD is consenting that
 *      the first browser visit will land directly in the org wizard
 *      (which still includes the telemetry consent step — that's
 *      non-bypassable, by design).
 *
 * Uses the same scrypt hashing as Better Auth so the seeded password
 * works for sign-in. Idempotent — skips if any users already exist.
 */

import { scrypt, randomBytes, randomUUID } from 'node:crypto';
import { promisify } from 'node:util';
import pg from 'pg';

const scryptAsync = promisify(scrypt);

// Must match Better Auth's scrypt config exactly (@noble/hashes/scrypt params)
const SCRYPT_CONFIG = { N: 16384, r: 16, p: 1, maxmem: 128 * 16384 * 16 * 2 };

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@aegis.local';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const ADMIN_NAME = process.env.ADMIN_NAME || 'Aegis Administrator';
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('  ERROR: DATABASE_URL not set');
  process.exit(1);
}

// ADMIN_PASSWORD empty → interactive mode: operator creates admin at
// /portal/setup. We exit cleanly so the entrypoint doesn't fail.
if (!ADMIN_PASSWORD) {
  console.log('  ADMIN_PASSWORD not set — skipping seed.');
  console.log('  On first visit, browse to /portal/setup to create your admin.');
  process.exit(0);
}

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  // IMPORTANT: Better Auth passes password and salt as strings to @noble/hashes/scrypt,
  // which treats them as UTF-8. Node's crypto.scrypt does the same with string inputs.
  // We must NOT decode the hex salt to binary (Buffer.from(salt, 'hex') = 16 bytes),
  // but instead pass it as the hex string itself (32 UTF-8 bytes) to match Better Auth.
  const derivedKey = await scryptAsync(
    password.normalize('NFKC'),
    salt,
    64,
    SCRYPT_CONFIG
  );
  return `${salt}:${derivedKey.toString('hex')}`;
}

async function main() {
  const pool = new pg.Pool({ connectionString: DATABASE_URL });

  try {
    // Check if any users exist
    const { rows } = await pool.query('SELECT COUNT(*) as count FROM "user"');
    const userCount = parseInt(rows[0].count, 10);

    if (userCount > 0) {
      console.log(`  Users already exist (${userCount}), skipping admin seed.`);
      return;
    }

    // Hash the password using scrypt (same as Better Auth)
    const hashedPassword = await hashPassword(ADMIN_PASSWORD);

    // Generate proper UUIDs (required by PostgreSQL UUID columns)
    const userId = randomUUID();
    const accountId = randomUUID();

    // Insert admin user
    await pool.query(
      `INSERT INTO "user" (id, email, name, role, "emailVerified", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, 'admin', true, NOW(), NOW())`,
      [userId, ADMIN_EMAIL, ADMIN_NAME]
    );

    // Insert credential account
    await pool.query(
      `INSERT INTO "account" (id, "userId", "accountId", "providerId", password, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, 'credential', $4, NOW(), NOW())`,
      [accountId, userId, userId, hashedPassword]
    );

    console.log(`  Admin created: ${ADMIN_EMAIL}`);
  } catch (err) {
    // Table might not exist yet on very first run — not fatal
    if (err.code === '42P01') {
      console.log('  Auth tables not ready yet, skipping admin seed.');
    } else {
      console.error('  Admin seed error:', err.message);
    }
  } finally {
    await pool.end();
  }
}

main();
