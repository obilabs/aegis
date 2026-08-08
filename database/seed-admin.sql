-- ============================================================================
-- Aegis ITSM - Default Admin Seed
-- ============================================================================
-- Creates a default admin account for fresh installations
--
-- DEFAULT CREDENTIALS:
--   Email: admin@aegis.local
--   Password: ChangeMe123!
--
-- IMPORTANT: Change this password immediately after first login!
-- ============================================================================

-- Better Auth uses scrypt (not bcrypt) for password hashing
-- Format: hex_salt:hex_hash
-- This hash is for "ChangeMe123!"

-- Only seed if no users exist (fresh install)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "user" LIMIT 1) THEN
    -- Insert default admin user
    INSERT INTO "user" (id, email, name, role, "emailVerified", "createdAt", "updatedAt")
    VALUES (
      'aegis-default-admin-001',
      'admin@aegis.local',
      'Aegis Administrator',
      'admin',
      true,
      NOW(),
      NOW()
    );

    -- Insert the credential account (email/password auth)
    -- Password hash is scrypt format for "ChangeMe123!"
    INSERT INTO "account" (id, "userId", "accountId", "providerId", password, "createdAt", "updatedAt")
    VALUES (
      'aegis-default-account-001',
      'aegis-default-admin-001',
      'admin@aegis.local',
      'credential',
      '93940572c07836621397efbc09325a99:8f532010f25cb4272dc8c22647967fa89d9bb317d02c5a3ed08d9bfcb866187aa8eb2ffb0a1b094f8050baaedff9dd2e6aa271c922f3b20489824fc936d64c1c',
      NOW(),
      NOW()
    );

    RAISE NOTICE 'Default admin created: admin@aegis.local / ChangeMe123!';
  ELSE
    RAISE NOTICE 'Users already exist, skipping admin seed.';
  END IF;
END $$;
