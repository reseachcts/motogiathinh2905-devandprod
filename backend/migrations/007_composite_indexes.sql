-- Composite index: payment kind + studentId speeds up tuition/rental
-- aggregate queries used in reports and notification recomputes.
CREATE INDEX IF NOT EXISTS idx_payments_kind_student ON payments(kind, studentId);
