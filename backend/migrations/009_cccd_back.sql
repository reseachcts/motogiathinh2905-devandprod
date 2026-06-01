-- Add CCCD-back photo slot (front already exists as `docs_cccd`).
-- Used by the guest kiosk flow: CCCD front + CCCD back + 3×4 portrait.

ALTER TABLE students ADD COLUMN docs_cccd_back     INTEGER NOT NULL DEFAULT 0;
ALTER TABLE students ADD COLUMN docs_cccd_back_url TEXT;
