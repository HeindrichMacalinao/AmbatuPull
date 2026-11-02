-- S1-DBA-04 read-only SQLite diagnostics (not a substitute for Python assertions)
PRAGMA foreign_keys = ON;
PRAGMA table_info('password_reset_token');
PRAGMA foreign_key_list('password_reset_token');
PRAGMA index_list('password_reset_token');
PRAGMA index_info('idx_password_reset_token_tokenHash');
PRAGMA index_info('idx_password_reset_token_user_state_expiry');
PRAGMA foreign_key_check;
PRAGMA integrity_check;

-- Active, expired, and spent/revoked are mutually exclusive states.
-- Exact expiry instant counts as expired.  The caller must test the hash
-- digest with a parameterized query and ensure isUsed = 0 and expiry > now.
SELECT id, userId, isUsed, createdAt, expiresAt, usedAt,
       CASE
         WHEN isUsed = 1 THEN 'used'
         WHEN expiresAt <= CURRENT_TIMESTAMP THEN 'expired'
         ELSE 'active'
       END AS tokenState
  FROM password_reset_token;

-- Application-side redemption MUST be atomic, for example:
-- UPDATE password_reset_token SET isUsed=1, usedAt=CURRENT_TIMESTAMP
-- WHERE tokenHash=? AND isUsed=0 AND expiresAt>CURRENT_TIMESTAMP;
-- Require exactly one row modified; a second attempt must modify zero rows.
