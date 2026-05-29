-- Pad legacy 9-digit phones to 10. The seed CSVs had a mix of 9- and
-- 10-digit demo numbers; VN spec is exactly 10. Pad with trailing 0 to
-- preserve a deterministic shape. New writes go through the frontend
-- Input (maxDigits=10) so this only affects historical seed data.

UPDATE accounts  SET phone = phone || '0' WHERE phone IS NOT NULL AND LENGTH(phone) = 9;
UPDATE students  SET phone = phone || '0' WHERE phone IS NOT NULL AND LENGTH(phone) = 9;
UPDATE teachers  SET phone = phone || '0' WHERE phone IS NOT NULL AND LENGTH(phone) = 9;
