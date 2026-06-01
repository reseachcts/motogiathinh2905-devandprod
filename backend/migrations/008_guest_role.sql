-- Widen accounts.role to include 'guest' (lowest-tier kiosk users who
-- can only register students under their own ownership).
-- SQLite has no ALTER CONSTRAINT, so we rebuild the table.

CREATE TABLE accounts_new (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('admin','staff','guest')),
  branchId      TEXT,
  phone         TEXT,
  email         TEXT NOT NULL UNIQUE,
  passwordHash  TEXT,
  lastActive    TEXT,
  active        INTEGER NOT NULL DEFAULT 1
);

INSERT INTO accounts_new SELECT * FROM accounts;
DROP TABLE accounts;
ALTER TABLE accounts_new RENAME TO accounts;
