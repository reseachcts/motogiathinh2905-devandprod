-- CCCD QR doc slot — surfaces the guest-kiosk QR photo as a first-class
-- slot on the admin student profile (alongside cccd / cccd_back).
-- Wrapped with the screen-students "GUEST-QR-PACK" block in the
-- frontend so this whole addition can be reverted as a unit.

ALTER TABLE students ADD COLUMN docs_cccd_qr     INTEGER NOT NULL DEFAULT 0;
ALTER TABLE students ADD COLUMN docs_cccd_qr_url TEXT;
