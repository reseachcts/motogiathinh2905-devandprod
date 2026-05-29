-- Vehicle rental feature.
--
-- vehicles.price  - rental price per "lượt" (round), VND. Defaults to 0
--                   so existing vehicles stay free until an admin sets a
--                   price; the rental modal disables vehicles with price=0.
-- payments.kind   - 'tuition' (existing teaching-fee receipts) or
--                   'rental' (pay-on-the-spot vehicle rental). Backfills
--                   to 'tuition' for every row already in the table.
-- payments.vehicleId    - target vehicle when kind='rental'; null otherwise.
-- payments.rentalRounds - number of lượt purchased when kind='rental'.
--
-- Per spec: rental payments are linked to a student profile but do NOT
-- count toward outstanding-balance settlements and do NOT appear in
-- the dashboard / Thanh toán list / branch revenue rollups. They live
-- inside the vehicle detail card and the formal report's dedicated
-- "Cho thuê xe" section.

ALTER TABLE vehicles ADD COLUMN price        INTEGER NOT NULL DEFAULT 0;

ALTER TABLE payments ADD COLUMN kind         TEXT    NOT NULL DEFAULT 'tuition';
ALTER TABLE payments ADD COLUMN vehicleId    TEXT;
ALTER TABLE payments ADD COLUMN rentalRounds INTEGER;

CREATE INDEX IF NOT EXISTS idx_payments_kind    ON payments(kind);
CREATE INDEX IF NOT EXISTS idx_payments_vehicle ON payments(vehicleId);
