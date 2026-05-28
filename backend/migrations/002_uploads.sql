-- 002_uploads.sql — add file-URL columns alongside the existing booleans.
-- Booleans stay as a fast "filled?" check; *_url is the storage path
-- (relative to backend/data/uploads/). NULL when nothing's uploaded.

-- Students: one URL per doc slot.
ALTER TABLE students ADD COLUMN docs_cccd_url      TEXT;
ALTER TABLE students ADD COLUMN docs_gksk_url      TEXT;
ALTER TABLE students ADD COLUMN docs_donDeNghi_url TEXT;
ALTER TABLE students ADD COLUMN docs_the3x4_url    TEXT;

-- Payments: biên lai photo URL.
ALTER TABLE payments ADD COLUMN bienLaiPhoto_url   TEXT;
