-- 003_notif_types.sql — broaden notifications.type CHECK to include 'doc'.
--
-- Why: the frozen frontend (webapp/screen-notifs.jsx) counts entries with
-- `type === "doc"` for its "Hồ sơ thiếu" stat. The original schema declared
-- the enum as ('payment','profile','system'), so the auto-generated
-- profile-incomplete rows landed under 'profile' and the UI stat stayed at 0
-- forever. We migrate the existing data + relax the CHECK so future writes
-- can use 'doc' (which the frontend already understands).
--
-- SQLite can't ALTER a CHECK constraint in place — we rebuild the table.
-- Idempotent: if the live schema already lists 'doc' (because a previous
-- run of notifications.js's now-retired IIFE applied the same patch), we
-- still rewrite any legacy auto-profile-* rows to 'doc' so the frontend's
-- "Hồ sơ thiếu" stat picks them up. The rebuild itself is harmless either
-- way because the migration only runs once (tracked in _migrations).
--
-- Steps:
--   1. Rename old notifications → notifications_old (preserves rows).
--   2. Recreate notifications with the broadened CHECK.
--   3. Copy rows back, rewriting 'profile' → 'doc' on the auto-* rows so the
--      frontend's existing filter starts counting them. Hand-created
--      notifications keep whatever type they had.
--   4. Drop the old table + recreate the index.
--   5. Apply the legacy auto-profile-* → 'doc' rewrite explicitly as a
--      belt-and-braces UPDATE — covers DBs where the IIFE already broadened
--      the CHECK but predated the rewrite step.

PRAGMA foreign_keys = OFF;

ALTER TABLE notifications RENAME TO notifications_old;

CREATE TABLE notifications (
  id         TEXT PRIMARY KEY,
  type       TEXT NOT NULL CHECK (type IN ('payment','profile','doc','system')),
  severity   TEXT NOT NULL CHECK (severity IN ('info','warn','danger')),
  title      TEXT NOT NULL,
  message    TEXT,
  studentId  TEXT,
  read       INTEGER NOT NULL DEFAULT 0,
  createdAt  TEXT NOT NULL
);

INSERT INTO notifications (id, type, severity, title, message, studentId, read, createdAt)
SELECT
  id,
  CASE WHEN id LIKE 'auto-%' AND type = 'profile' THEN 'doc' ELSE type END,
  severity, title, message, studentId, read, createdAt
FROM notifications_old;

DROP TABLE notifications_old;

CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);

-- Belt-and-braces: if any auto-profile-* row still claims type='profile' in
-- the rebuilt table (shouldn't happen given the SELECT above, but harmless
-- to run), flip it to 'doc' so the UI's "Hồ sơ thiếu" filter sees it.
UPDATE notifications SET type = 'doc'
  WHERE id LIKE 'auto-profile-%' AND type != 'doc';

PRAGMA foreign_keys = ON;
