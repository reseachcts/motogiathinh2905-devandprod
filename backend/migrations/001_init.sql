-- MOTOGIATHINH CRM schema. Mirrors BACKEND.md §2 with SQLite-native types.
-- Booleans are INTEGER 0/1; dates are TEXT "dd/mm/yyyy" or "dd/mm/yyyy HH:MM:SS"
-- (same on-the-wire format the frozen frontend already parses).

CREATE TABLE IF NOT EXISTS branches (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  address     TEXT,
  manager_id  TEXT
);

CREATE TABLE IF NOT EXISTS accounts (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('admin','staff')),
  branchId      TEXT,
  phone         TEXT,
  email         TEXT NOT NULL UNIQUE,
  passwordHash  TEXT,
  lastActive    TEXT,
  active        INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS classes (
  id              TEXT PRIMARY KEY,
  code            TEXT NOT NULL,
  branchId        TEXT NOT NULL,
  openDate        TEXT NOT NULL,
  examDate        TEXT NOT NULL,
  statusOverride  TEXT  -- nullable; if set, takes precedence over date-derived status
);
-- Note: classes.code is NOT globally unique. The same monthly cohort label
-- (e.g. "MÔ TÔ 05/2026") repeats per branch AND per cohort within a branch.
-- The natural identifier is the surrogate id; code is a human-facing label.
CREATE INDEX IF NOT EXISTS idx_classes_branch ON classes(branchId);
CREATE INDEX IF NOT EXISTS idx_classes_code   ON classes(code);

CREATE TABLE IF NOT EXISTS students (
  id                  TEXT PRIMARY KEY,
  maHV                TEXT NOT NULL UNIQUE,
  name                TEXT NOT NULL,
  phone               TEXT,
  dob                 TEXT,
  gender              TEXT,
  idNumber            TEXT UNIQUE,
  address             TEXT,
  queQuan             TEXT,
  ngayCapCCCD         TEXT,
  noiCapCCCD          TEXT,
  classId             TEXT,
  licence             TEXT CHECK (licence IN ('A','A1')),
  feePlanId           TEXT,
  promotionId         TEXT,
  totalFee            INTEGER NOT NULL DEFAULT 0,
  profileComplete     INTEGER NOT NULL DEFAULT 0,
  responsibleStaffId  TEXT,
  branchId            TEXT,
  createdAt           TEXT NOT NULL,
  docs_cccd           INTEGER NOT NULL DEFAULT 0,
  docs_gksk           INTEGER NOT NULL DEFAULT 0,
  docs_donDeNghi      INTEGER NOT NULL DEFAULT 0,
  docs_the3x4         INTEGER NOT NULL DEFAULT 0,
  notes               TEXT
);
CREATE INDEX IF NOT EXISTS idx_students_branch  ON students(branchId);
CREATE INDEX IF NOT EXISTS idx_students_class   ON students(classId);
CREATE INDEX IF NOT EXISTS idx_students_created ON students(createdAt);

CREATE TABLE IF NOT EXISTS payments (
  id            TEXT PRIMARY KEY,
  studentId     TEXT NOT NULL,
  branchId      TEXT NOT NULL,
  staffId       TEXT,
  amount        INTEGER NOT NULL CHECK (amount != 0),
  method        TEXT NOT NULL,
  bienLaiId     TEXT NOT NULL UNIQUE,
  bienLaiPhoto  INTEGER NOT NULL DEFAULT 0,
  createdAt     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_payments_student ON payments(studentId);
CREATE INDEX IF NOT EXISTS idx_payments_branch  ON payments(branchId);
CREATE INDEX IF NOT EXISTS idx_payments_created ON payments(createdAt);

CREATE TABLE IF NOT EXISTS fee_plans (
  id      TEXT PRIMARY KEY,
  name    TEXT NOT NULL,
  licence TEXT NOT NULL CHECK (licence IN ('A','A1')),
  amount  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS promotions (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  appliesTo_csv  TEXT NOT NULL DEFAULT '',  -- pipe-joined "A|A1"; frontend splits
  discount       INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS teachers (
  id       TEXT PRIMARY KEY,
  name     TEXT NOT NULL,
  phone    TEXT,
  yearsExp INTEGER NOT NULL DEFAULT 0,
  branchId TEXT,
  active   INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS vehicles (
  id       TEXT PRIMARY KEY,
  name     TEXT,
  licence  TEXT,
  plate    TEXT,
  year     INTEGER,
  branchId TEXT,
  status   TEXT
);

CREATE TABLE IF NOT EXISTS notifications (
  id         TEXT PRIMARY KEY,
  type       TEXT NOT NULL CHECK (type IN ('payment','profile','system')),
  severity   TEXT NOT NULL CHECK (severity IN ('info','warn','danger')),
  title      TEXT NOT NULL,
  message    TEXT,
  studentId  TEXT,
  read       INTEGER NOT NULL DEFAULT 0,
  createdAt  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);

CREATE TABLE IF NOT EXISTS activity_log (
  id     TEXT PRIMARY KEY,
  userId TEXT,
  action TEXT NOT NULL,
  target TEXT,
  at     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_activity_at ON activity_log(at);
