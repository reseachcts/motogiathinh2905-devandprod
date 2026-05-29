-- Strip non-digits from stored phone numbers + CCCD ids.
-- Render-level formatting (e.g. "090 555 0001") now happens in the
-- frontend via window.fmtPhone / window.fmtCCCD; the DB stores bare
-- digits as the canonical form.

-- SQLite has no native regex replace; chain TRIM/REPLACE over the known
-- separator characters (space, dot, hyphen, paren). This catches every
-- formatted phone in the seed CSVs and any future write that slips a
-- separator through.

-- accounts.phone
UPDATE accounts SET phone =
  REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(phone,
    ' ',''), '.',''), '-',''), '(',''), ')',''), '+','')
WHERE phone IS NOT NULL;

-- students.phone
UPDATE students SET phone =
  REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(phone,
    ' ',''), '.',''), '-',''), '(',''), ')',''), '+','')
WHERE phone IS NOT NULL;

-- teachers.phone
UPDATE teachers SET phone =
  REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(phone,
    ' ',''), '.',''), '-',''), '(',''), ')',''), '+','')
WHERE phone IS NOT NULL;

-- students.idNumber — strip separators, then truncate any over-12-digit
-- values to the first 12 digits (some seed rows had 13-digit ids).
UPDATE students SET idNumber =
  SUBSTR(
    REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(idNumber,
      ' ',''), '.',''), '-',''), '(',''), ')',''), '+',''),
    1, 12)
WHERE idNumber IS NOT NULL;
